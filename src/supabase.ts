import { createClient } from "@supabase/supabase-js";

// Клієнт Supabase — адреса та ключ живуть у .env (не в коді!)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default supabase;
