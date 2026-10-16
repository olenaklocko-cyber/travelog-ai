-- Тиждень 3: фонові задачі для тревелогу.
-- 1) Щоденний звіт (pg_cron, раз на добу)
-- 2) Черга фонових задач (queue)

-- 1) Таблиця фонових задач (черга)
CREATE TABLE IF NOT EXISTS fonovi_zadachi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  typ text NOT NULL, -- 'zvit', 'obrobotka_foto', 'ai_rekomendaciya'
  danі jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ochikuyu', -- 'ochikuyu', 'pracyuye', 'gotovo', 'pomylka'
  spryamovano_at timestamptz DEFAULT now(),
  zakincheno_at timestamptz,
  pomylka text,
  pryoritet int NOT NULL DEFAULT 0
);

-- Індекс для швидкого пошуку «наступної задачі»
CREATE INDEX IF NOT EXISTS idx_fonovi_status ON fonovi_zadachi(status, pryoritet DESC, spryamovano_at);

-- RLS: кожен бачить лише свої задачі (для авторизованих)
ALTER TABLE fonovi_zadachi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "korystuvach_bachyt_svoi" ON fonovi_zadachi
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "korystuvach_stvoryuye" ON fonovi_zadachi
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2) Таблиця щоденних звітів
CREATE TABLE IF NOT EXISTS zvity_den (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  den date NOT NULL UNIQUE, -- один звіт на день
  vsego_podorozhey int DEFAULT 0,
  vsego_vytrat numeric DEFAULT 0,
  vsego_zibrano numeric DEFAULT 0,
  kilkist_korystuvachiv int DEFAULT 0,
  stvoreno_at timestamptz DEFAULT now()
);

ALTER TABLE zvity_den ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zvity_publichni" ON zvity_den
  FOR SELECT USING (true);

-- 3) Функція: обробити одну фонову задачу
CREATE OR REPLACE FUNCTION obratyty_fonovu_zadachu()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  zadacha fonovi_zadachi%ROWTYPE;
BEGIN
  -- Беремо наступну задачу в черзі (з блокуванням рядка)
  SELECT * INTO zadacha
  FROM fonovi_zadachi
  WHERE status = 'ochikuyu'
  ORDER BY pryoritet DESC, spryamovano_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN; -- черга порожня
  END IF;

  -- Позначаємо як «працює»
  UPDATE fonovi_zadachi
  SET status = 'pracyuyе', zakincheno_at = now()
  WHERE id = zadacha.id;

  -- Виконуємо роботу за типом
  IF zadacha.typ = 'zvit' THEN
    PERFORM vykonaty_zvit_dnya();
  ELSIF zadacha.typ = 'obrobotka_foto' THEN
    -- Імітація обробки фото (в реальності — resize, compress)
    PERFORM pg_sleep(0.1);
  ELSIF zadacha.typ = 'ai_rekomendaciya' THEN
    -- Імітація AI-запиту (в реальності — виклик LLM API)
    PERFORM pg_sleep(0.2);
  END IF;

  -- Позначаємо як «готово»
  UPDATE fonovi_zadachi
  SET status = 'gotovo', zakincheno_at = now()
  WHERE id = zadacha.id;
END;
$$;

-- 4) Функція: щоденний звіт
CREATE OR REPLACE FUNCTION vykonaty_zvit_dnya()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vsego_pod int;
  vsego_vyr numeric;
  vsego_zib numeric;
  kilkist_kor int;
BEGIN
  SELECT
    count(*),
    coalesce(sum(vytracheno), 0),
    coalesce(sum(zibrano), 0),
    (SELECT count(DISTINCT user_id) FROM trips)
  INTO vsego_pod, vsego_vyr, vsego_zib, kilkist_kor
  FROM trips_z_vidatamy;

  INSERT INTO zvity_den (den, vsego_podorozhey, vsego_vytrat, vsego_zibrano, kilkist_korystuvachiv)
  VALUES (current_date, vsego_pod, vsego_vyr, vsego_zib, kilkist_kor)
  ON CONFLICT (den) DO UPDATE
  SET vsego_podorozhey = EXCLUDED.vsego_podorozhey,
      vsego_vytrat = EXCLUDED.vsego_vytrat,
      vsego_zibrano = EXCLUDED.vsego_zibrano,
      kilkist_korystuvachiv = EXCLUDED.kilkist_korystuvachiv,
      stvoreno_at = now();
END;
$$;

-- 5) Функція: покласти задачу в чергу
CREATE OR REPLACE FUNCTION poklasty_u_chergu(
  p_typ text,
  p_dani jsonb DEFAULT '{}',
  p_pryoritet int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  novyi_id uuid;
BEGIN
  INSERT INTO fonovi_zadachi (typ, danі, pryoritet)
  VALUES (p_typ, p_dani, p_pryoritet)
  RETURNING id INTO novyi_id;
  RETURN novyi_id;
END;
$$;

-- 6) Розклад: щоденний звіт о 00:00 (pg_cron)
-- Спочатку активуємо розширення
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Плануємо: щодня о 00:00 запускати звіт
SELECT cron.schedule(
  'zvit-dnya',
  '0 0 * * *',  -- крон-вираз: о 00:00 щодня
  $$SELECT vykonaty_zvit_dnya()$$
);

-- 7) Обробка черги: кожні 5 хвилин обробляти задачі
CREATE OR REPLACE FUNCTION obrobyty_chergu()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  i int := 0;
BEGIN
  WHILE i < 10 LOOP
    PERFORM obratyty_fonovu_zadachu();
    EXIT WHEN NOT FOUND;
    i := i + 1;
  END LOOP;
END;
$fn$;

SELECT cron.schedule(
  'obrobka-cherhy',
  '*/5 * * * *',  -- кожні 5 хвилин
  'SELECT obrobyty_chergu()'
);

-- 8) Тригер: при створенні подорожі — фонова задача на AI-рекомендацію
CREATE OR REPLACE FUNCTION fonova_ai_rekomendaciya()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Кладемо в чергу фонову задачу (AI-факти про країну)
  PERFORM poklasty_u_chergu(
    'ai_rekomendaciya',
    jsonb_build_object('trip_id', NEW.id, 'country', NEW.country_code),
    1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ai_rekomendaciya ON trips;
CREATE TRIGGER tr_ai_rekomendaciya
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION fonova_ai_rekomendaciya();

-- 9) Перевірка: скільки задач у черзі та скільки звітів
SELECT 'fonovi_zadachi' as tabel, count(*) FROM fonovi_zadachi
UNION ALL
SELECT 'zvity_den', count(*) FROM zvity_den;

-- 10) Тест: покласти задачу в чергу вручну
SELECT poklasty_u_chergu('zvit', '{"reason": "manual_test"}'::jsonb, 5);
