import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseConfig = Boolean(url && anon)

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url!, anon!, {
      auth: {
        // a sessão da equipe fica guardada e se renova sozinha
        persistSession: true,
        autoRefreshToken: true,
        // não usamos link mágico nem OAuth — nada para ler da URL
        detectSessionInUrl: false,
        storageKey: 'nexla-forms-auth',
      },
    })
  : null
