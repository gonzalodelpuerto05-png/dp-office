import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // La sesión vive solo en memoria/sessionStorage: al cerrar el navegador
    // se pierde y hay que loguearse de nuevo, tal como lo pidió el cliente.
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
  },
})
