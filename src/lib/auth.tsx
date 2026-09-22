/**
 * Autenticação da equipe.
 *
 * Com Supabase configurado, é o Supabase Auth de verdade: a senha nunca
 * passa pelo código do front, a sessão é guardada e renovada sozinha, e o
 * token authenticated é o que abre as tabelas no banco (ver RLS no schema).
 *
 * Sem Supabase (modo demo, quando o banco não está ligado), cai num login
 * de faz-de-conta só para dar para navegar no painel.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface TeamUser {
  name: string
  email: string
  role: string
  initials: string
}

/** Só vale no modo demo — não existe ninguém com essa senha no banco. */
export const DEMO_CREDENTIALS = { email: 'demo@demo.app', password: 'demo' }

interface AuthShape {
  user: TeamUser | null
  loading: boolean
  /** true quando o login é de faz-de-conta (sem Supabase) */
  demo: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
}

const Ctx = createContext<AuthShape>({
  user: null,
  loading: true,
  demo: false,
  signIn: async () => ({ ok: false }),
  signOut: () => {},
})

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toTeamUser(u: User): TeamUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    u.email?.split('@')[0] ||
    'Equipe'
  return {
    name,
    email: u.email ?? '',
    role: 'Administrador',
    initials: initialsOf(name),
  }
}

/** Traduz os erros do Supabase para algo que a equipe entende. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha não confere.'
  if (m.includes('email not confirmed')) return 'Esse e-mail ainda não foi confirmado.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Sem conexão com o servidor. Confira a internet.'
  return message
}

const DEMO_KEY = 'dossie:session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = !supabase
  const [user, setUser] = useState<TeamUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      try {
        const raw = localStorage.getItem(DEMO_KEY)
        if (raw) setUser(JSON.parse(raw) as TeamUser)
      } catch {
        /* sessão corrompida — ignora */
      }
      setLoading(false)
      return
    }

    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setUser(data.session?.user ? toTeamUser(data.session.user) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toTeamUser(session.user) : null)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthShape>(
    () => ({
      user,
      loading,
      demo,
      async signIn(email, password) {
        const mail = email.trim().toLowerCase()

        if (!supabase) {
          await new Promise((r) => setTimeout(r, 500))
          if (mail !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
            return { ok: false, error: 'E-mail ou senha não confere.' }
          }
          const fake: TeamUser = {
            name: 'Modo demo',
            email: mail,
            role: 'Sem banco',
            initials: 'MD',
          }
          localStorage.setItem(DEMO_KEY, JSON.stringify(fake))
          setUser(fake)
          return { ok: true }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: mail,
          password,
        })
        if (error) return { ok: false, error: friendly(error.message) }
        if (data.user) setUser(toTeamUser(data.user))
        return { ok: true }
      },
      signOut() {
        if (supabase) void supabase.auth.signOut()
        else localStorage.removeItem(DEMO_KEY)
        setUser(null)
      },
    }),
    [user, loading, demo],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
