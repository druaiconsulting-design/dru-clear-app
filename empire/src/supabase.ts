import { createClient } from "@supabase/supabase-js";

// The same Supabase project as the Intelligence Hub. The key below is the public
// (anon) key; what a signed-in account can read is decided by the database's own rules.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
