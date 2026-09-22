import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import schemaSql from '../../supabase/schema.sql?raw'
import { useAuth, type TeamUser } from '../lib/auth'
import type { Backend } from '../lib/db'
import { cn, copy } from '../lib/utils'
import { Logo } from './ui/Chrome'
import { Button } from './ui/Button'
import { Modal, useToast } from './ui/Feedback'
import { spring } from '../lib/anim'

const NAV = [
  { to: '/painel', label: 'Meus formulários', end: true },
  { to: '/painel/novo', label: 'Criar novo', end: false },
]

/**
 * Foto de perfil da equipe. Usa a logo da Nexla; se ela não carregar,
 * cai nas iniciais, que é o que existia antes.
 */
function Avatar({ user, size = 'md' }: { user: TeamUser | null; size?: 'md' | 'lg' }) {
  const [quebrou, setQuebrou] = useState(false)
  const box = size === 'lg' ? 'h-10 w-10 text-[14px]' : 'h-9 w-9 text-[13px]'

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white',
        box,
      )}
      style={{ background: quebrou ? undefined : '#11111f' }}
    >
      {quebrou ? (
        <span className="bg-brand grid h-full w-full place-items-center">{user?.initials}</span>
      ) : (
        <img
          src="/nexla.jpg"
          alt=""
          className="h-full w-full object-cover"
          onError={() => setQuebrou(true)}
        />
      )}
    </span>
  )
}

export default function AppShell({ backend }: { backend: Backend | null }) {
  const { user, signOut } = useAuth()
  const [sqlOpen, setSqlOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const toast = useToast()
  const location = useLocation()

  // a aba do painel se identifica; a do cliente mostra o formulário dele
  useEffect(() => {
    document.title = 'Formulários · painel'
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* ── barra superior ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center gap-3 px-4 sm:px-6">
          <Link to="/painel" className="shrink-0">
            <Logo />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      'relative block rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors',
                      isActive ? 'text-brand' : 'text-ink-3 hover:text-ink',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-brand-soft"
                        transition={spring}
                      />
                    )}
                    <span className="relative">{n.label}</span>
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <motion.button
                type="button"
                onClick={() => setMenu((v) => !v)}
                whileTap={{ scale: 0.94 }}
                className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2.5 transition-colors hover:bg-canvas-2"
              >
                <Avatar user={user} />
                <span className="hidden text-[13.5px] font-semibold text-ink-2 sm:block">
                  {user?.name.split(' ')[0]}
                </span>
              </motion.button>

              <AnimatePresence>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.14 } }}
                      transition={spring}
                      className="absolute right-0 z-20 mt-2 w-60 origin-top-right overflow-hidden rounded-[16px] border border-line bg-surface shadow-lg"
                    >
                      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                        <Avatar user={user} size="lg" />
                        <span className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-ink">{user?.name}</p>
                          <p className="truncate text-[12.5px] text-ink-3">{user?.email}</p>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={signOut}
                        className="w-full cursor-pointer px-4 py-2.5 text-left text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-canvas-2 hover:text-danger"
                      >
                        Sair da conta
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* nav mobile */}
        <div className="flex gap-1 border-t border-line px-4 pb-2 sm:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  isActive ? 'bg-brand-soft text-brand' : 'text-ink-3',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </header>

      {/* ── aviso de modo demo ─────────────────────────── */}
      <AnimatePresence>
        {backend === 'local' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-warn/25 bg-warn-soft"
          >
            <div className="mx-auto flex max-w-[1140px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
              <span className="text-[13.5px] font-semibold text-warn">Modo demo</span>
              <p className="text-[13px] text-ink-2">
                Sem conexão com o banco — o que você criar fica salvo só neste navegador.
              </p>
              <button
                type="button"
                onClick={() => setSqlOpen(true)}
                className="cursor-pointer text-[13px] font-semibold text-brand underline underline-offset-4"
              >
                Ligar o banco
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 pt-8 pb-24 sm:px-6">
        <Outlet key={location.pathname} />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1140px] px-4 py-5 text-[12.5px] text-ink-3 sm:px-6">
          Formulários · painel interno
        </div>
      </footer>

      <Modal
        open={sqlOpen}
        onClose={() => setSqlOpen(false)}
        title="Ligar o Supabase"
        description="Quatro passos e o painel passa a salvar no banco."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSqlOpen(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await copy(schemaSql)
                toast(
                  ok ? 'SQL copiado. Cola no SQL Editor e dá Run.' : 'Não consegui copiar.',
                  ok ? 'ok' : 'error',
                )
              }}
            >
              Copiar SQL
            </Button>
          </>
        }
      >
        <ol className="space-y-2.5">
          {[
            'Abre o painel do Supabase deste projeto.',
            'Vai em SQL Editor → New query.',
            'Cola o conteúdo de supabase/schema.sql e clica em Run.',
            'Recarrega esta página — o aviso some e tudo passa a salvar no banco.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[14px] leading-relaxed text-ink-2">{t}</span>
            </li>
          ))}
        </ol>
        <pre className="mt-5 max-h-52 overflow-auto rounded-[12px] border border-line bg-surface-2 p-3.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
          {schemaSql.slice(0, 780)}…
        </pre>
      </Modal>
    </div>
  )
}
