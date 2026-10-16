-- Тиждень 4: реальний час для тревелогу.
-- 1) Дозволяємо realtime на таблиці trips (зміни видно всім)
-- 2) Таблиця "хто онлайн" (presence)

-- 1) Додаємо таблицю trips до realtime
-- Supabase realtime працює через WALRUS (postgres_wal)
ALTER PUBLICATION supabase_realtime ADD TABLE trips;

-- 2) Таблиця для відстеження онлайн-користувачів
-- Кожен користувач "реєструється" коли заходить, "виходить" коли закриває
CREATE TABLE IF NOT EXISTS online_korystuvachi (
  sid text PRIMARY KEY,          -- унікальний id сесії (генерується в браузері)
  user_id uuid,                  -- якщо залогінений
  user_name text,                -- ім'я для показу
  storinka text DEFAULT '/',     -- яка сторінка відкрита
  zayshov_at timestamptz DEFAULT now(),
  oshchniy_at timestamptz DEFAULT now()  -- останній "heartbeat"
);

-- RLS: всі можуть бачити онлайн, але оновлювати лише свої записи
ALTER TABLE online_korystuvachi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vsi_bachyt_online" ON online_korystuvachi;
CREATE POLICY "vsi_bachyt_online" ON online_korystuvachi
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "zayisty_svoi" ON online_korystuvachi;
CREATE POLICY "zayisty_svoi" ON online_korystuvachi
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "onovlyty_svoi" ON online_korystuvachi;
CREATE POLICY "onovlyty_svoi" ON online_korystuvachi
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "vyity_svoi" ON online_korystuvachi;
CREATE POLICY "vyity_svoi" ON online_korystuvachi
  FOR DELETE USING (true);

-- 3) Таблиця сповіщень (realtime-новини для всіх)
CREATE TABLE IF NOT EXISTS spovishennya (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  typ text NOT NULL,              -- 'nova_podorozh', 'vydalena', 'komentar'
  danі jsonb NOT NULL DEFAULT '{}',
  user_id uuid,
  user_name text,
  stvoreno_at timestamptz DEFAULT now()
);

ALTER TABLE spovishennya ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vsi_bachyt_spovishennya" ON spovishennya;
CREATE POLICY "vsi_bachyt_spovishennya" ON spovishennya
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "stvoryuvaty_spovishennya" ON spovishennya;
CREATE POLICY "stvoryuvaty_spovishennya" ON spovishennya
  FOR INSERT WITH CHECK (true);

-- Додаємо до realtime
ALTER PUBLICATION supabase_realtime ADD TABLE spovishennya;
ALTER PUBLICATION supabase_realtime ADD TABLE online_korystuvachi;

-- 4) Тригер: при створенні подорожі — сповіщення для всіх
CREATE OR REPLACE FUNCTION spovistyty_novu_podorozh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO spovishennya (typ, danі, user_id)
  VALUES ('nova_podorozh',
    jsonb_build_object('title', NEW.title, 'country', NEW.country_code, 'trip_id', NEW.id),
    NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_spovistyty ON trips;
CREATE TRIGGER tr_spovistyty
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION spovistyty_novu_podorozh();

-- 5) Тригер: при видаленні — сповіщення
CREATE OR REPLACE FUNCTION spovistyty_vydalenu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO spovishennya (typ, danі, user_id)
  VALUES ('vydalena',
    jsonb_build_object('title', OLD.title, 'country', OLD.country_code, 'trip_id', OLD.id),
    OLD.user_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_spovistyty_vydalennya ON trips;
CREATE TRIGGER tr_spovistyty_vydalennya
  AFTER DELETE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION spovistyty_vydalenu();

-- 6) Функція: "я тут" (heartbeat)
CREATE OR REPLACE FUNCTION ya_tut(
  p_sid text,
  p_user_id uuid DEFAULT NULL,
  p_user_name text DEFAULT NULL,
  p_storinka text DEFAULT '/'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO online_korystuvachi (sid, user_id, user_name, storinka, oshchniy_at)
  VALUES (p_sid, p_user_id, p_user_name, p_storinka, now())
  ON CONFLICT (sid) DO UPDATE
  SET oshchniy_at = now(),
      storinka = EXCLUDED.storinka,
      user_name = COALESCE(EXCLUDED.user_name, online_korystuvachi.user_name);
END;
$$;

-- 7) Функція: піти (видалити сесію)
CREATE OR REPLACE FUNCTION vyity(p_sid text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM online_korystuvachi WHERE sid = p_sid;
END;
$$;

-- 8) Очищення "мертвих" сесій (більше 1 хв без heartbeat)
CREATE OR REPLACE FUNCTION ochystyty_mertvi_online()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vilucheno int;
BEGIN
  DELETE FROM online_korystuvachi
  WHERE oshchniy_at < now() - interval '1 minute';
  GET DIAGNOSTICS vilucheno = ROW_COUNT;
  RETURN vilucheno;
END;
$$;

-- 9) Cron: очищувати мертві сесії кожну хвилину
SELECT cron.schedule(
  'ochystyty-online',
  '* * * * *',
  'SELECT ochystyty_mertvi_online()'
);

-- 10) Тест: скільки зараз онлайн
SELECT 'online' as shcho, count(*) as kilkist FROM online_korystuvachi
UNION ALL
SELECT 'spovishennya', count(*) FROM spovishennya;
