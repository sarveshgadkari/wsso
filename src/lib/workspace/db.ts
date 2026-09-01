/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Query builder for tables added in saas/09 until generated Database types include them. */
export function ops(client: SupabaseClient<any>, table: string) {
  return client.from(table) as any
}
