import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// Service-role client — bypasses RLS.
// ONLY import from server-side files: API routes, server actions, migration scripts.
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
