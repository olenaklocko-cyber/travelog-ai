-- Тиждень 5: логи і моніторинг для тревелогу.
-- Таблиця логів: помилки, події, попередження.

-- 1) Таблиця логів
CREATE TABLE IF NOT EXISTS logy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  riven text NOT NULL DEFAULT 'info',    -- 'debug', 'info', 'warning', 'error', 'critical'
  dzherelo text NOT NULL,                -- 'client', 'server', 'api'
  povidomlennya text NOT NULL,           -- текст помилки/події
  kontekst jsonb DEFAULT '{}',           -- додаткові дані (стек, URL, user_id тощо)
  user_id uuid,
  storinka text,                         -- де сталась помилка
  user_agent text,                       -- браузер
  stvoreno_at timestamptz DEFAULT now()
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_logy_riven ON logy(riven, stvoreno_at DESC);
CREATE INDEX IF NOT EXISTS idx_logy_dzherelo ON logy(dzherelo, stvoreno_at DESC);
CREATE INDEX IF NOT EXISTS idx_logy_stvoreno ON logy(stvoreno_at DESC);

-- RLS
ALTER TABLE logy ENABLE ROW LEVEL SECURITY;

-- Кожен бачить свої логи (за user_id), анонімні — всі
DROP POLICY IF EXISTS "bachelo_logy" ON logy;
CREATE POLICY "bachelo_logy" ON logy
  FOR SELECT USING (
    auth.uid() IS NULL OR  -- анонім бачить все (для демо)
    user_id = auth.uid() OR
    auth.uid() IS NOT NULL -- залогінений бачить все (для куратора)
  );

-- Вставка логів дозволена всім (клієнт пише свої помилки)
DROP POLICY IF EXISTS "pysaty_logy" ON logy;
CREATE POLICY "pysaty_logy" ON logy
  FOR INSERT WITH CHECK (true);

-- 2) Функція: швидкий запис логу
CREATE OR REPLACE FUNCTION zapysaty_log(
  p_riven text,
  p_dzherelo text,
  p_povidomlennya text,
  p_kontekst jsonb DEFAULT '{}',
  p_user_id uuid DEFAULT NULL,
  p_storinka text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  novyi_id uuid;
BEGIN
  INSERT INTO logy (riven, dzherelo, povidomlennya, kontekst, user_id, storinka)
  VALUES (p_riven, p_dzherelo, p_povidomlennya, p_kontekst, p_user_id, p_storinka)
  RETURNING id INTO novyi_id;
  RETURN novyi_id;
END;
$$;

-- 3) Метрики: агрегована статистика за день
CREATE OR REPLACE VIEW metryky_dnya AS
SELECT
  date(stvoreno_at) as den,
  riven,
  count(*) as kilkist,
  count(DISTINCT dzherelo) as dzherel
FROM logy
WHERE stvoreno_at > now() - interval '7 days'
GROUP BY date(stvoreno_at), riven
ORDER BY den DESC, riven;

-- 4) Агрегована статистика помилок
CREATE OR REPLACE VIEW metryky_pomylok AS
SELECT
  riven,
  dzherelo,
  povidomlennya,
  count(*) as kilkist,
  max(stvoreno_at) as ostanniy_raza
FROM logy
WHERE riven IN ('error', 'critical')
  AND stvoreno_at > now() - interval '24 hours'
GROUP BY riven, dzherelo, povidomlennya
ORDER BY kilkist DESC
LIMIT 20;

-- 5) Автоочищення старих логів (більше 30 днів) через cron
CREATE OR REPLACE FUNCTION ochystyty_stari_logy()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vilucheno int;
BEGIN
  DELETE FROM logy WHERE stvoreno_at < now() - interval '30 days';
  GET DIAGNOSTICS vilucheno = ROW_COUNT;
  RETURN vilucheno;
END;
$$;

SELECT cron.schedule(
  'ochystyty-logy',
  '0 3 * * *',  -- щодня о 03:00
  'SELECT ochystyty_stari_logy()'
);

-- 6) Тест: записати тестовий лог
SELECT zapysaty_log('info', 'sql', 'Тестовий лог з SQL', '{"test": true}');

-- 7) Показати логи
SELECT riven, dzherelo, povidomlennya, stvoreno_at
FROM logy
ORDER BY stvoreno_at DESC
LIMIT 10;
