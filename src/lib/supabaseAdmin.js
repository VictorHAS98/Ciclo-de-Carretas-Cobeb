import { createClient } from '@supabase/supabase-js'

// Cliente com service role key — usado apenas para operações de auth admin
// (criar usuários, alterar senhas, banir contas).
// Operações de banco de dados usam o cliente normal (src/lib/supabase.js) com RLS.
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
