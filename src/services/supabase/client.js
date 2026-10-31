import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://zkzgkovwktljfuuuhivk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
