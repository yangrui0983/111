import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let configured = false

function createSafeClient(): SupabaseClient {
  try {
    if (supabaseUrl && supabaseAnonKey) {
      const client = createClient(supabaseUrl, supabaseAnonKey)
      configured = true
      return client
    }
  } catch (e) {
    console.warn('Supabase 初始化失败，将以离线模式运行:', e)
  }
  // Return a proxy that safely no-ops everything when not configured
  return new Proxy({} as SupabaseClient, {
    get(_target, _prop) {
      // Return a function that returns null for any property access
      const noop = (..._args: unknown[]) => Promise.resolve({ data: null, error: null })
      return new Proxy(noop as any, {
        get() { return noop }
      })
    }
  })
}

export const supabase = createSafeClient()

export function isSupabaseConfigured(): boolean {
  return configured
}
