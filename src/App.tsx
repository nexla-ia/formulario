import { Suspense, lazy, useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { getBackend, initBackend, seedDemo, type Backend } from './lib/db'
import PublicForm from './pages/PublicForm'
import NotFound from './pages/NotFound'

/* O painel é carregado sob demanda: o link do cliente (/f/:slug) não
   baixa nada de admin, nem a leitura de planilha. */
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NewForm = lazy(() => import('./pages/NewForm'))
const FormDetail = lazy(() => import('./pages/FormDetail'))
const AppShell = lazy(() => import('./components/AppShell'))

export default function App() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const [backend, setBackend] = useState<Backend | null>(null)

  useEffect(() => {
    let alive = true
    initBackend().then(async (b) => {
      if (b === 'local') await seedDemo()
      if (alive) setBackend(getBackend())
    })
    return () => {
      alive = false
    }
  }, [])

  const booting = loading || backend === null

  if (booting) return <Boot />

  return (
    <>
      <AnimatePresence mode="wait">
        <Suspense fallback={<Boot />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/f/:slug" element={<PublicForm />} />
            <Route path="/entrar" element={user ? <Navigate to="/painel" replace /> : <Login />} />
            <Route element={<Guard user={!!user} />}>
              <Route element={<AppShell backend={backend} />}>
                <Route path="/painel" element={<Dashboard />} />
                <Route path="/painel/novo" element={<NewForm />} />
                <Route path="/painel/f/:id" element={<FormDetail />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to={user ? '/painel' : '/entrar'} replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  )
}

function Guard({ user }: { user: boolean }) {
  const location = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function Boot() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-11 w-11">
          <span className="absolute inset-0 animate-ping rounded-[13px] bg-brand/30" />
          <span className="relative grid h-11 w-11 place-items-center rounded-[13px] bg-brand text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="5" width="16" height="2.6" rx="1.3" fill="currentColor" />
              <rect x="4" y="10.7" width="16" height="2.6" rx="1.3" fill="currentColor" opacity=".7" />
              <rect x="4" y="16.4" width="9" height="2.6" rx="1.3" fill="currentColor" opacity=".45" />
            </svg>
          </span>
        </div>
        <p className="text-[13px] font-semibold text-ink-3">carregando…</p>
      </div>
    </div>
  )
}
