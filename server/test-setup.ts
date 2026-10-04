/**
 * Тестове середовище: підставляємо «фейкові» адреси Supabase,
 * щоб тести ніколи не полізли в реальну базу і не розкривали ключі.
 * Насправді мережеві виклики у тестах замокані (fetch → мок).
 */
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.VITE_VLASYNYK_EMAIL = "olenaklocko@gmail.com";
