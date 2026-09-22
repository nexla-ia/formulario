import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import gsap from 'gsap'
import { DEMO_CREDENTIALS, useAuth } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Logo, Marquee } from '../components/ui/Chrome'

const HEADLINE = ['Sua', 'planilha', 'vira', 'formulário.']

export default function Login() {
  const { signIn, demo } = useAuth()
  const navigate = useNavigate()
  const scope = useRef<HTMLDivElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Coreografia de entrada + movimento contínuo do fundo. */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('[data-a="brand"]', { y: -20, opacity: 0, duration: 0.7 })
        .from('[data-a="word"]', { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.1)
        .from('[data-a="lead"]', { y: 18, opacity: 0, duration: 0.7 }, 0.45)
        .from('[data-a="chip"]', { y: 14, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.07 }, 0.55)
        .from('[data-a="float"]', { y: 40, opacity: 0, scale: 0.92, duration: 0.9, stagger: 0.1 }, 0.4)
        .from('[data-a="panel"]', { x: 40, opacity: 0, duration: 0.9 }, 0.15)
        .from('[data-a="row"]', { y: 16, opacity: 0, duration: 0.55, stagger: 0.07 }, 0.5)

      // fundo respirando
      gsap.to('[data-blob="1"]', {
        x: 90,
        y: -60,
        scale: 1.18,
        duration: 13,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      gsap.to('[data-blob="2"]', {
        x: -70,
        y: 70,
        scale: 1.12,
        duration: 16,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      gsap.to('[data-blob="3"]', {
        x: 60,
        y: 50,
        scale: 0.9,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      // cartõezinhos flutuando
      gsap.utils.toArray<HTMLElement>('[data-a="float"]').forEach((el, i) => {
        gsap.to(el, {
          y: `+=${12 + i * 5}`,
          rotate: i % 2 ? 1.6 : -1.6,
          duration: 3.6 + i * 0.7,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.3,
        })
      })
    }, scope)
    return () => ctx.revert()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await signIn(email, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Não deu certo.')
      gsap.fromTo(
        '[data-a="card"]',
        { x: -10 },
        { x: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.3)' },
      )
      return
    }
    navigate('/painel', { replace: true })
  }

  return (
    <div ref={scope} className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* ══ painel da marca ══ */}
      <section className="relative isolate flex min-h-[46vh] flex-col overflow-hidden bg-[#221c6b] px-6 py-8 text-white sm:px-10 lg:min-h-dvh lg:flex-[1.05] lg:px-14 lg:py-10">
        <div className="mesh">
          <span
            data-blob="1"
            className="h-[26rem] w-[26rem] bg-[#5646f5]"
            style={{ top: '-4rem', left: '-6rem' }}
          />
          <span
            data-blob="2"
            className="h-[22rem] w-[22rem] bg-[#c23ad6]"
            style={{ bottom: '2rem', right: '-4rem', opacity: 0.85 }}
          />
          <span
            data-blob="3"
            className="h-[18rem] w-[18rem] bg-[#2bc8e6]"
            style={{ top: '38%', left: '38%', opacity: 0.6 }}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div data-a="brand">
          <Logo invert />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10 lg:py-0">
          <h1 className="max-w-xl text-[clamp(2.3rem,5.6vw,3.9rem)] leading-[1.03] font-extrabold tracking-[-0.035em]">
            {HEADLINE.map((w, i) => (
              <span key={w} className="mr-[0.26em] inline-block overflow-hidden align-bottom">
                <span
                  data-a="word"
                  className={i === 3 ? 'inline-block text-[#9ff0ff]' : 'inline-block'}
                >
                  {w}
                </span>
              </span>
            ))}
          </h1>

          <p data-a="lead" className="mt-5 max-w-md text-[16px] leading-relaxed text-white/70">
            Sobe a planilha de perguntas, ajusta o que quiser e manda o link com senha para o
            cliente. Cada cliente com o endereço dele.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {['Planilha .xlsx / .csv', '13 tipos de campo', 'Link com senha', 'Respostas em planilha'].map(
              (t) => (
                <span
                  key={t}
                  data-a="chip"
                  className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold backdrop-blur-sm"
                >
                  {t}
                </span>
              ),
            )}
          </div>

          {/* mini-cartões flutuando */}
          <div className="mt-10 hidden gap-3 lg:flex">
            {[
              { t: 'Briefing de marca', c: 'Brisa Café', p: 72 },
              { t: 'Onboarding', c: 'Norte Log.', p: 40 },
              { t: 'Pesquisa NPS', c: 'Aurora', p: 91 },
            ].map((f) => (
              <div
                key={f.t}
                data-a="float"
                className="w-[9.5rem] rounded-[14px] border border-white/15 bg-white/10 p-3.5 backdrop-blur-md"
              >
                <div className="mb-2 h-1.5 w-8 rounded-full bg-[#9ff0ff]" />
                <p className="text-[13px] leading-tight font-bold">{f.t}</p>
                <p className="mt-0.5 text-[11.5px] text-white/55">{f.c}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${f.p}%` }}
                    transition={{ duration: 1.4, delay: 1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Marquee
          className="hidden lg:block"
          items={[
            'briefings',
            'onboarding de cliente',
            'pesquisas',
            'checklists',
            'cadastros',
            'diagnósticos',
          ]}
        />
      </section>

      {/* ══ formulário de acesso ══ */}
      <section
        data-a="panel"
        className="relative isolate flex flex-1 items-center justify-center px-5 py-12 sm:px-10"
      >
        {/* o lado claro era um vazio chapado com um cartão solto no meio */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(70% 55% at 50% 38%, color-mix(in srgb, var(--color-brand) 10%, transparent) 0%, transparent 70%)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.55]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--color-line) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(65% 50% at 50% 40%, #000 0%, transparent 75%)',
          }}
        />

        <form
          data-a="card"
          onSubmit={submit}
          className="w-full max-w-[25rem] rounded-xl2 border border-line bg-surface p-7 shadow-lg sm:p-8"
        >
          <motion.span
            className="mb-5 grid h-12 w-12 place-items-center overflow-hidden rounded-[14px] shadow-sm"
            style={{ background: '#11111f' }}
            initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.15 }}
          >
            <img src="/nexla.jpg" alt="Nexla" className="h-full w-full object-cover" />
          </motion.span>

          <h2 className="text-[26px] font-extrabold tracking-[-0.03em]">Entrar no painel</h2>
          <p className="mt-1 text-[14px] text-ink-3">Acesso restrito à equipe.</p>

          <div className="mt-7 space-y-4">
            <div data-a="row">
              <Field label="E-mail" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  invalid={!!error}
                  required
                />
              </Field>
            </div>

            <div data-a="row">
              <Field label="Senha" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={!!error}
                  required
                />
              </Field>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-[10px] bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div data-a="row" className="pt-1">
              <Button type="submit" size="lg" block loading={busy}>
                {busy ? 'Conferindo…' : 'Acessar painel'}
              </Button>
            </div>
          </div>

          {demo && (
            <div data-a="row" className="mt-6 rounded-[14px] border border-dashed border-warn/40 bg-warn-soft p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold tracking-[0.04em] text-warn uppercase">
                    Modo demo — sem banco
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-2">
                    {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    setEmail(DEMO_CREDENTIALS.email)
                    setPassword(DEMO_CREDENTIALS.password)
                    setError(null)
                  }}
                >
                  Preencher
                </Button>
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
