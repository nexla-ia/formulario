import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import gsap from 'gsap'
import { animate, stagger } from 'animejs'
import {
  getPublicMeta,
  submitResponse,
  unlockForm,
  type PublicFormMeta,
  type SubmitMode,
} from '../lib/db'
import type { AnswerValue, FormRecord, Question, ResponseRecord } from '../lib/types'
import {
  accentOnSurface,
  answerText,
  cn,
  fullDate,
  isEmail,
  isSkipped,
  isValidCep,
  isValidDoc,
  isUrl,
  readableOn,
  SKIP_ANSWER,
} from '../lib/utils'
import { notifyFilled } from '../lib/notify'
import AnswerInput, { type AnswerValueT, type Palette } from '../components/AnswerInput'
import { CheckBurst } from '../components/ui/Chrome'
import { spring, stepVariants } from '../lib/anim'

type Phase = 'loading' | 'missing' | 'blocked' | 'locked' | 'intro' | 'form' | 'sent'

function buildPalette(accent: string, dark: boolean): Palette {
  const bg = dark ? '#171a21' : '#ffffff'
  const fg = dark ? '#f4f5f8' : '#16181f'
  return {
    bg,
    canvas: dark ? '#0f1115' : `color-mix(in srgb, ${accent} 8%, #f4f5f9)`,
    fg,
    muted: dark ? 'rgba(244,245,248,0.55)' : '#868da1',
    line: dark ? 'rgba(244,245,248,0.15)' : '#e2e6f0',
    accent,
    onAccent: readableOn(accent),
    accentText: accentOnSurface(accent, bg, fg),
    dark,
  }
}

export default function PublicForm() {
  const { slug = '' } = useParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [meta, setMeta] = useState<PublicFormMeta | null>(null)
  const [form, setForm] = useState<FormRecord | null>(null)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [errKey, setErrKey] = useState(0)
  const [unlocking, setUnlocking] = useState(false)
  const [checking, setChecking] = useState(false)
  /** o que o cliente já tinha enviado antes — abre a tela preenchida */
  const [previous, setPrevious] = useState<ResponseRecord | null>(null)
  const [sentMode, setSentMode] = useState<SubmitMode>('created')

  const palette = useMemo(() => {
    const theme = form?.theme ?? meta?.theme
    return buildPalette(theme?.accent ?? '#5646f5', theme?.surface === 'ink')
  }, [form, meta])

  // A aba do navegador é a primeira coisa que o cliente lê. Antes dizia
  // "Formulários · painel" — nome interno, que não diz nada para ele.
  useEffect(() => {
    const titulo = form?.title ?? meta?.title
    const cliente = form?.client_name ?? meta?.client_name
    document.title = titulo
      ? cliente
        ? `${titulo} · ${cliente}`
        : titulo
      : 'Formulário'
    return () => {
      document.title = 'Formulário'
    }
  }, [form, meta])

  // O tema do formulário vale para a página inteira, não só para o conteúdo:
  // fundo do documento e barra de rolagem incluídos.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.formSurface = palette.dark ? 'ink' : 'paper'
    root.style.setProperty('--form-canvas', palette.canvas)
    root.style.setProperty(
      '--form-thumb',
      palette.dark ? 'rgba(255,255,255,0.18)' : 'rgba(22,24,31,0.18)',
    )
    root.style.setProperty(
      '--form-thumb-hover',
      palette.dark ? 'rgba(255,255,255,0.3)' : 'rgba(22,24,31,0.3)',
    )
    return () => {
      delete root.dataset.formSurface
      root.style.removeProperty('--form-canvas')
      root.style.removeProperty('--form-thumb')
      root.style.removeProperty('--form-thumb-hover')
    }
  }, [palette.canvas, palette.dark])

  useEffect(() => {
    let alive = true
    getPublicMeta(slug)
      .then(async (m) => {
        if (!alive) return
        if (!m) return setPhase('missing')
        setMeta(m)
        if (m.status !== 'published') return setPhase('blocked')
        if (m.locked) return setPhase('locked')
        const res = await unlockForm(slug, '')
        if (!alive) return
        if (res.ok && res.form) {
          setForm(res.form)
          setPrevious(res.response ?? null)
          // no modo lista a capa é redundante, e quem já respondeu também
          // não precisa dela — vai direto para as perguntas
          setPhase(res.response || res.form.theme.flow === 'cards' ? 'form' : 'intro')
        } else setPhase('blocked')
      })
      .catch(() => alive && setPhase('missing'))
    return () => {
      alive = false
    }
  }, [slug])

  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setPwError(null)
    const res = await unlockForm(slug, password)
    setChecking(false)
    if (!res.ok || !res.form) {
      // chave nova a cada tentativa: errar duas vezes seguidas sacode de novo
      setPwError(res.reason === 'password' ? 'Senha incorreta.' : 'Formulário indisponível.')
      setErrKey((n) => n + 1)
      return
    }
    // deixa o cadeado abrir antes de trocar de tela
    setUnlocking(true)
    const destino = res.response || res.form.theme.flow === 'cards' ? 'form' : 'intro'
    window.setTimeout(() => {
      setForm(res.form!)
      setPrevious(res.response ?? null)
      setPhase(destino)
    }, 760)
  }

  /** Volta para o formulário já com o que está gravado no servidor. */
  async function reopen() {
    const res = await unlockForm(slug, password)
    if (res.ok && res.form) {
      setForm(res.form)
      setPrevious(res.response ?? null)
    }
    setPhase('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (phase === 'loading')
    return (
      <Shell palette={palette} center>
        <Pulse palette={palette} />
      </Shell>
    )

  if (phase === 'missing')
    return (
      <Shell palette={palette} center>
        <Notice
          palette={palette}
          tone="danger"
          title="Esse link não existe"
          body="Confira o endereço com quem te mandou — pode ter faltado um pedaço."
        />
      </Shell>
    )

  if (phase === 'blocked')
    return (
      <Shell palette={palette} center>
        <Notice
          palette={palette}
          tone="warn"
          title={
            meta?.status === 'closed'
              ? 'Este formulário foi encerrado'
              : 'Este formulário ainda não abriu'
          }
          body={
            meta?.status === 'closed'
              ? 'Não estamos mais recebendo respostas por aqui. Fale com quem te enviou o link.'
              : 'Quem te mandou o link ainda está finalizando as perguntas. Tente de novo mais tarde.'
          }
        />
      </Shell>
    )

  if (phase === 'locked')
    return (
      <Shell palette={palette} center>
        <Gate
          palette={palette}
          meta={meta}
          password={password}
          setPassword={setPassword}
          error={pwError}
          errKey={errKey}
          unlocking={unlocking}
          busy={checking}
          onSubmit={tryUnlock}
        />
      </Shell>
    )

  if (!form)
    return (
      <Shell palette={palette} center>
        <Pulse palette={palette} />
      </Shell>
    )

  if (phase === 'intro')
    return (
      <Shell palette={palette} center>
        <Intro
          palette={palette}
          form={form}
          previous={previous}
          onStart={() => setPhase('form')}
        />
      </Shell>
    )

  if (phase === 'sent')
    return (
      <Shell palette={palette} center>
        <Sent palette={palette} form={form} mode={sentMode} onEditAgain={reopen} />
      </Shell>
    )

  return (
    <Shell palette={palette}>
      <Runner
        palette={palette}
        form={form}
        password={password}
        previous={previous}
        onSent={(mode) => {
          setSentMode(mode)
          setPhase('sent')
        }}
      />
    </Shell>
  )
}

/* ══════════════ moldura ══════════════ */

/** Grão fino por cima de tudo — tira o ar de bloco de cor chapada. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

function Shell({
  palette,
  children,
  /** telas de um cartão só (senha, aviso, agradecimento) ficam no meio */
  center,
}: {
  palette: Palette
  children: React.ReactNode
  center?: boolean
}) {
  return (
    <div
      className={cn('relative min-h-dvh', center && 'flex flex-col')}
      style={{ background: palette.canvas, color: palette.fg }}
    >
      {/*
        A leitura pede coluna estreita, mas num monitor largo isso deixa
        dois desertos nas laterais. A atmosfera fica presa ao centro e as
        bordas escurecem: o vazio vira moldura, não sobra.
      */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute top-[-20rem] left-1/2 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full"
          style={{
            background: palette.accent,
            opacity: palette.dark ? 0.22 : 0.16,
            filter: 'blur(120px)',
          }}
          animate={{ y: [0, 26, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-18rem] left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full"
          style={{
            background: palette.accent,
            opacity: palette.dark ? 0.13 : 0.09,
            filter: 'blur(120px)',
          }}
          animate={{ y: [0, -22, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(125% 85% at 50% 0%, transparent 34%, ${palette.canvas} 100%)`,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            backgroundImage: GRAIN,
            backgroundSize: '180px 180px',
            opacity: palette.dark ? 0.055 : 0.035,
          }}
        />
      </div>

      <div
        className={cn(
          'relative mx-auto w-full max-w-[42rem] px-4 pt-6 pb-10 sm:px-6 sm:pt-10 sm:pb-14',
          center && 'flex flex-1 flex-col justify-center',
        )}
      >
        {children}
      </div>

      <footer className="relative mx-auto w-full max-w-[42rem] px-4 pb-10 sm:px-6">
        <div
          className="flex items-center justify-center gap-2 pt-5"
          style={{ borderTop: `1px solid ${palette.line}` }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: palette.muted }}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.6" stroke="currentColor" strokeWidth="1.9" />
            <path d="M8.4 10.5V7.9a3.6 3.6 0 0 1 7.2 0v2.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <span className="text-[12.5px]" style={{ color: palette.muted }}>
            Formulário enviado com segurança
          </span>
        </div>
      </footer>
    </div>
  )
}

function Card({
  palette,
  children,
  className,
  topBar,
  hover,
}: {
  palette: Palette
  children: React.ReactNode
  className?: string
  topBar?: boolean
  hover?: boolean
}) {
  return (
    <motion.div
      className={cn('overflow-hidden rounded-[16px] shadow-sm', className)}
      style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
      whileHover={hover ? { y: -2, boxShadow: '0 12px 28px -10px rgba(20,24,40,0.2)' } : undefined}
      transition={spring}
    >
      {topBar && <div className="h-2.5 w-full" style={{ background: palette.accent }} />}
      {children}
    </motion.div>
  )
}

/** Logo da equipe no topo dos cartões. */
function BrandLogo({
  src,
  bg,
  size = 'md',
  className,
}: {
  src?: string | null
  /** cor que a própria logo traz de fundo — evita o quadrado destoando da tela */
  bg?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!src) return null
  return (
    <motion.span
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn('inline-grid place-items-center overflow-hidden', className)}
      style={
        bg
          ? {
              background: bg,
              padding: size === 'sm' ? '4px 7px' : '10px 14px',
              borderRadius: size === 'sm' ? 8 : 14,
            }
          : undefined
      }
    >
      <img
        src={src}
        alt=""
        className={cn(
          'w-auto object-contain',
          size === 'sm' ? 'max-h-10 max-w-[170px]' : 'max-h-32 max-w-[380px]',
        )}
      />
    </motion.span>
  )
}

function Pulse({ palette }: { palette: Palette }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <motion.div
        className="h-10 w-10 rounded-full border-[3px] border-t-transparent"
        style={{ borderColor: `${palette.accent}40`, borderTopColor: palette.accent }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  )
}

function Notice({
  palette,
  tone,
  title,
  body,
}: {
  palette: Palette
  tone: 'danger' | 'warn'
  title: string
  body: string
}) {
  const color = tone === 'danger' ? '#e11d48' : '#d97706'
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="mt-[12dvh]"
    >
      <Card palette={palette}>
        <div className="px-6 py-10 text-center sm:px-10">
          <motion.div
            className="mx-auto grid h-14 w-14 place-items-center rounded-full"
            style={{ background: `${color}1a`, color }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 7.5v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1.4" fill="currentColor" />
            </svg>
          </motion.div>
          <h1 className="mt-5 text-[24px] leading-tight font-extrabold tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed" style={{ color: palette.muted }}>
            {body}
          </p>
        </div>
      </Card>
    </motion.div>
  )
}

/* ══════════════ senha ══════════════ */

/** Faíscas que saem do cadeado quando a senha está certa. */
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { deg, x: Math.cos(rad) * 27, y: Math.sin(rad) * 27 }
})

function Gate({
  palette,
  meta,
  password,
  setPassword,
  error,
  errKey,
  unlocking,
  busy,
  onSubmit,
}: {
  palette: Palette
  meta: PublicFormMeta | null
  password: string
  setPassword: (v: string) => void
  error: string | null
  /** sobe a cada tentativa errada, para repetir a animação */
  errKey: number
  /** senha certa: o cadeado abre antes de trocar de tela */
  unlocking: boolean
  busy: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const scope = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(false)
  const logo = meta?.theme.logo

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-g]', { y: 24, opacity: 0, duration: 0.75, stagger: 0.09, ease: 'expo.out' })
    }, scope)
    return () => ctx.revert()
  }, [])

  /* ── senha errada: o cartão nega com a cabeça e o cadeado chacoalha ── */
  useEffect(() => {
    if (!error || !errKey) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .to('[data-gate]', {
          keyframes: { x: [0, -13, 11, -8, 6, -3, 0] },
          duration: 0.5,
          ease: 'power2.out',
        })
        .fromTo(
          '[data-lock]',
          { rotate: 0 },
          { keyframes: { rotate: [0, -14, 12, -8, 0] }, duration: 0.45, ease: 'power2.out' },
          0,
        )
        .fromTo(
          '[data-lock-ring]',
          { scale: 1, opacity: 0.55 },
          { scale: 1.9, opacity: 0, duration: 0.6, ease: 'power2.out' },
          0,
        )
    }, scope)
    navigator.vibrate?.(55)
    return () => ctx.revert()
  }, [error, errKey])

  /* ── senha certa: a trava sobe, um anel abre e o cartão sai de cena ── */
  useEffect(() => {
    if (!unlocking) return
    const shackle = scope.current?.querySelector('[data-shackle]')
    const faiscas = scope.current?.querySelectorAll('[data-spark]')
    const paradas: { pause: () => void }[] = []

    if (shackle) {
      paradas.push(
        animate(shackle, {
          translateY: [0, -5],
          rotate: [0, -22],
          duration: 420,
          ease: 'outBack',
        }),
      )
    }
    if (faiscas?.length) {
      paradas.push(
        animate(faiscas, {
          scale: [0.2, 1],
          opacity: [0, 1, 0],
          duration: 620,
          delay: stagger(26, { start: 150 }),
          ease: 'outCubic',
        }),
      )
    }

    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay: 0.12 })
        .to('[data-lock]', { scale: 1.18, duration: 0.2, ease: 'back.out(3)' })
        .to('[data-lock]', { scale: 1, duration: 0.2, ease: 'power2.out' })
        .fromTo(
          '[data-lock-ring]',
          { scale: 0.9, opacity: 0.6 },
          { scale: 2.6, opacity: 0, duration: 0.7, ease: 'power3.out' },
          0,
        )
        .to('[data-gate]', { y: -16, opacity: 0, duration: 0.42, ease: 'power2.in' }, 0.3)
    }, scope)

    return () => {
      paradas.forEach((a) => a.pause())
      ctx.revert()
    }
  }, [unlocking])

  return (
    <div ref={scope} className="mt-[8dvh]">
      <div data-gate>
        <Card palette={palette} topBar>
          <form onSubmit={onSubmit} className="px-6 py-8 sm:px-9">
            {logo && (
              <div data-g className="mb-6 flex justify-center">
                <BrandLogo src={logo} bg={meta?.theme.logoBg} />
              </div>
            )}

            <div data-g className="flex justify-center">
              <span className="relative grid h-14 w-14 place-items-center">
                {/* onda que sai do cadeado: vermelha quando erra, da cor do
                    formulário quando abre */}
                <span
                  data-lock-ring
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0"
                  style={{ border: `2px solid ${error ? '#e11d48' : palette.accent}` }}
                />
                {/* faíscas da abertura — posição por left/top, nunca por
                    transform: o anime.js escreve transform e apagaria isso */}
                {SPARKS.map(({ deg, x, y }) => (
                  <span
                    key={deg}
                    data-spark
                    aria-hidden
                    className="pointer-events-none absolute h-1.5 w-1.5 rounded-full opacity-0"
                    style={{
                      background: palette.accent,
                      left: `calc(50% + ${x}px - 3px)`,
                      top: `calc(50% + ${y}px - 3px)`,
                    }}
                  />
                ))}

                <motion.div
                  className="grid h-14 w-14 place-items-center"
                  animate={unlocking ? { y: 0 } : { y: [0, -5, 0] }}
                  transition={
                    unlocking
                      ? { duration: 0.2 }
                      : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                >
                {/* o GSAP mexe neste, o Motion no de fora — cada um com o seu
                    transform, senão um apaga o do outro */}
                <span
                  data-lock
                  className="grid h-14 w-14 place-items-center rounded-full"
                  style={{
                    background: `${error ? '#e11d48' : palette.accent}1f`,
                    color: error ? '#e11d48' : palette.accentText,
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke="currentColor" strokeWidth="2" />
                    <path
                      data-shackle
                      d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{ transformBox: 'fill-box', transformOrigin: '100% 100%' }}
                    />
                  </svg>
                </span>
                </motion.div>
              </span>
            </div>

            {meta?.client_name && (
              <p data-g className="mt-5 text-center text-[13px] font-bold" style={{ color: palette.accentText }}>
                {meta.client_name}
              </p>
            )}
            <h1 data-g className="mt-1 text-center text-[25px] leading-tight font-extrabold tracking-[-0.03em]">
              {meta?.title ?? 'Formulário'}
            </h1>
            <p data-g className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-relaxed" style={{ color: palette.muted }}>
              Este formulário é protegido. Digite a senha que veio junto com o link.
            </p>

            <div data-g className="mx-auto mt-7 max-w-sm">
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="••••••••"
                className="w-full rounded-[12px] border px-4 py-3.5 text-center text-[19px] tracking-[0.3em] outline-none transition-[border-color,box-shadow] duration-200"
                style={{
                  borderColor: error ? '#e11d48' : focus ? palette.accent : palette.line,
                  background: palette.dark ? 'rgba(255,255,255,0.04)' : '#fff',
                  color: palette.fg,
                  boxShadow: focus ? `0 0 0 4px ${palette.accent}22` : 'none',
                }}
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2.5 text-center text-[13px] font-semibold text-[#e11d48]"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={busy || !password}
                className="mt-5 w-full cursor-pointer rounded-[12px] px-6 py-3.5 text-[15px] font-bold disabled:opacity-45"
                style={{ background: palette.accent, color: palette.onAccent }}
                whileHover={busy ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
              >
                {busy ? 'Conferindo…' : 'Abrir formulário'}
              </motion.button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

/* ══════════════ abertura ══════════════ */

function Intro({
  palette,
  form,
  previous,
  onStart,
}: {
  palette: Palette
  form: FormRecord
  previous: ResponseRecord | null
  onStart: () => void
}) {
  const scope = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-i]', { y: 26, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' })
    }, scope)
    return () => ctx.revert()
  }, [])

  const minutes = Math.max(2, Math.round(form.questions.length * 0.5))
  const sections = [...new Set(form.questions.map((q) => q.section).filter(Boolean) as string[])]

  return (
    <div ref={scope} className="mt-[6dvh]">
      <div data-i>
        <Card palette={palette} topBar>
          <div className="px-6 py-8 sm:px-9">
            {form.theme.logo && (
              <div className="mb-5">
                <BrandLogo src={form.theme.logo} bg={form.theme.logoBg} />
              </div>
            )}
            {form.client_name && (
              <p className="text-[13px] font-bold" style={{ color: palette.accentText }}>
                {form.client_name}
              </p>
            )}
            <h1 className="mt-1.5 text-[clamp(1.7rem,5vw,2.2rem)] leading-[1.1] font-extrabold tracking-[-0.035em]">
              {form.title}
            </h1>
            {form.intro && !previous && (
              <p className="mt-3.5 text-[15px] leading-relaxed" style={{ color: palette.muted }}>
                {form.intro}
              </p>
            )}

            {previous && (
              <div
                className="mt-4 rounded-[12px] px-3.5 py-3"
                style={{ background: `${palette.accent}14` }}
              >
                <p className="text-[13.5px] font-bold" style={{ color: palette.accentText }}>
                  Você já respondeu este formulário
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: palette.muted }}>
                  Enviado em {fullDate(previous.submitted_at)}
                  {previous.updated_at && ` · corrigido em ${fullDate(previous.updated_at)}`}. Pode
                  abrir, conferir e corrigir o que precisar.
                </p>
              </div>
            )}

            <div
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-4 text-[13px] font-medium"
              style={{ borderColor: palette.line, color: palette.muted }}
            >
              <span>{form.questions.length} perguntas</span>
              <span>·</span>
              <span>cerca de {minutes} min</span>
              {form.password && (
                <>
                  <span>·</span>
                  <span>acesso protegido</span>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {sections.length > 0 && (
        <div data-i className="mt-3">
          <Card palette={palette}>
            <div className="px-6 py-5 sm:px-9">
              <p className="text-[12.5px] font-bold tracking-[0.05em] uppercase" style={{ color: palette.muted }}>
                O que vamos perguntar
              </p>
              <ul className="mt-3 space-y-2">
                {sections.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.07, duration: 0.45 }}
                    className="flex items-center gap-2.5 text-[14.5px]"
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                      style={{ background: `${palette.accent}1f`, color: palette.accentText }}
                    >
                      {i + 1}
                    </span>
                    {s}
                  </motion.li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      )}

      <div data-i className="mt-5">
        <motion.button
          type="button"
          onClick={onStart}
          className="w-full cursor-pointer rounded-[14px] px-8 py-4 text-[16px] font-bold shadow-sm sm:w-auto"
          style={{ background: palette.accent, color: palette.onAccent }}
          whileHover={{ y: -3, boxShadow: `0 14px 28px -10px ${palette.accent}` }}
          whileTap={{ scale: 0.98, y: 0 }}
          transition={spring}
        >
          {previous ? 'Ver e corrigir minhas respostas' : 'Começar →'}
        </motion.button>
      </div>
    </div>
  )
}

/**
 * De onde vêm as respostas ao abrir: do que está gravado no servidor, ou
 * do rascunho local se ele for mais novo (o cliente fechou a aba no meio).
 */
function initialAnswers(storeKey: string, previous: ResponseRecord | null): Answers {
  const fromServer: Answers = {}
  let serverAt = ''
  if (previous) {
    for (const a of previous.answers) fromServer[a.question_id] = a.value
    serverAt = previous.updated_at || previous.submitted_at
  }

  let draft: Answers | null = null
  let draftAt = ''
  try {
    const raw = localStorage.getItem(storeKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
        draft = parsed.answers as Answers
        draftAt = String(parsed.at ?? '')
      } else {
        draft = parsed as Answers // formato antigo, sem data
      }
    }
  } catch {
    draft = null
  }

  if (!draft) return fromServer
  if (!previous) return draft
  // rascunho só ganha se for posterior ao que o servidor guardou
  return draftAt && draftAt > serverAt ? { ...fromServer, ...draft } : fromServer
}

/* ══════════════ preenchimento ══════════════ */

type Answers = Record<string, AnswerValueT>

function Runner({
  palette,
  form,
  password,
  previous,
  onSent,
}: {
  palette: Palette
  form: FormRecord
  password: string
  previous: ResponseRecord | null
  onSent: (mode: SubmitMode) => void
}) {
  const storeKey = `dossie:answers:${form.slug}`
  const steps = form.theme.flow === 'steps'
  const cards = form.theme.flow === 'cards'
  const editing = !!previous
  /** índice da pergunta aberta na janelinha (modo lista) */
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  /* A etiqueta do bloco gruda embaixo da barra de topo. A altura da barra
     muda com o tamanho da tela, então é medida em vez de chutada. */
  const topoRef = useRef<HTMLDivElement>(null)
  const [alturaTopo, setAlturaTopo] = useState(64)
  useLayoutEffect(() => {
    const el = topoRef.current
    if (!el) return
    const medir = () => setAlturaTopo(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(storeKey, previous))
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  /** 'fill' = respondendo · 'review' = conferindo antes de enviar.
   *  Quem já respondeu entra direto na lista do que enviou. */
  const [mode, setMode] = useState<'fill' | 'review'>(
    previous && form.theme.flow !== 'cards' ? 'review' : 'fill',
  )

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ at: new Date().toISOString(), answers }))
    } catch {
      /* ignora */
    }
  }, [answers, storeKey])

  const set = useCallback((id: string, v: AnswerValueT) => {
    setAnswers((a) => ({ ...a, [id]: v }))
    setErrors((e) => (e[id] ? { ...e, [id]: '' } : e))
  }, [])

  const validate = useCallback(
    (q: Question): string | null => {
      const v = answers[q.id]
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
      if (q.required && empty) return 'Essa pergunta é obrigatória.'
      if (empty) return null
      // quem marcou "não tenho" já respondeu — não passa pelas checagens de formato
      if (isSkipped(v)) return null
      if (q.type === 'email' && !isEmail(String(v))) return 'E-mail parece incompleto.'
      if (q.type === 'url' && !isUrl(String(v))) return 'Link parece inválido.'
      if (q.type === 'phone' && String(v).replace(/\D/g, '').length < 10)
        return 'Telefone incompleto.'
      if (q.type === 'doc' && !isValidDoc(String(v)))
        return 'Esse CPF ou CNPJ não confere. Revise os números.'
      if (q.type === 'cep' && !isValidCep(String(v))) return 'CEP tem 8 dígitos.'
      return null
    },
    [answers],
  )

  const answered = form.questions.filter((q) => {
    const v = answers[q.id]
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length
  const progress =
    steps && !cards
      ? (i + 1) / form.questions.length
      : form.questions.length
        ? answered / form.questions.length
        : 0

  function go(to: number) {
    if (to > i) {
      const q = form.questions[i]
      const err = validate(q)
      if (err) return setErrors((e) => ({ ...e, [q.id]: err }))
    }
    setDir(to > i ? 1 : -1)
    setI(Math.max(0, Math.min(form.questions.length - 1, to)))
  }

  /** Leva a pergunta de volta para a tela, vindo da revisão. */
  function editAnswer(index: number) {
    if (cards) {
      setOpenIdx(index)
      return
    }
    setMode('fill')
    if (steps) {
      setDir(index > i ? 1 : -1)
      setI(index)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      requestAnimationFrame(() =>
        document
          .getElementById(`pq-${form.questions[index].id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      )
    }
  }

  /** Confere tudo e, se estiver ok, abre a revisão. */
  function goReview() {
    const next: Record<string, string> = {}
    for (const q of form.questions) {
      const err = validate(q)
      if (err) next[q.id] = err
    }
    setErrors(next)
    const firstBad = form.questions.findIndex((q) => next[q.id])
    if (firstBad >= 0) {
      if (steps) {
        setDir(firstBad > i ? 1 : -1)
        setI(firstBad)
      } else {
        document
          .getElementById(`pq-${form.questions[firstBad].id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setMode('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function send() {
    // Entrando direto na revisão, a checagem do goReview não rodou.
    const pending: Record<string, string> = {}
    for (const q of form.questions) {
      const err = validate(q)
      if (err) pending[q.id] = err
    }
    const firstBad = form.questions.findIndex((q) => pending[q.id])
    if (firstBad >= 0) {
      setErrors(pending)
      editAnswer(firstBad)
      return
    }

    setSending(true)
    setFatal(null)
    const payload: AnswerValue[] = form.questions.map((q) => ({
      question_id: q.id,
      label: q.label,
      type: q.type,
      value: answers[q.id] ?? null,
    }))
    const identity = form.questions.find((q) => q.type === 'email')
    try {
      const mode = await submitResponse({
        slug: form.slug,
        password,
        answers: payload,
        respondent: identity ? String(answers[identity.id] ?? '') || null : null,
      })
      try {
        localStorage.removeItem(storeKey)
      } catch {
        /* ignora */
      }
      // Avisa a equipe. Solta e esquece: se o webhook falhar, o cliente
      // não vê nada — a resposta dele já está salva.
      void notifyFilled(form, {
        evento: mode === 'updated' ? 'corrigido' : 'preenchido',
        respondente: identity ? String(answers[identity.id] ?? '') || null : null,
        respondidas: payload.filter((a) => !!answerText(a.type, a.value)).length,
        total: form.questions.length,
      })
      onSent(mode)
    } catch (e) {
      setFatal(
        e instanceof Error && e.message === 'password'
          ? 'A senha mudou. Recarregue a página.'
          : 'Não consegui enviar agora. Tente de novo em instantes.',
      )
    } finally {
      setSending(false)
    }
  }

  const current = form.questions[i]
  const last = i === form.questions.length - 1

  return (
    <div>
      {/* ── topo ── */}
      <div ref={topoRef} className="sticky top-0 z-30 mb-5">
        {/*
          A faixa atravessa a tela inteira; só o conteúdo fica preso à
          coluna. Sem isso ela vira um retângulo solto no meio do monitor.
        */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-[100vw] -translate-x-1/2 backdrop-blur-xl"
          style={{
            background: `${palette.canvas}d9`,
            borderBottom: `1px solid ${palette.line}`,
          }}
        />
        <div className="relative py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <BrandLogo src={form.theme.logo} bg={form.theme.logoBg} size="sm" className="shrink-0" />
            <span className="truncate text-[13px] font-semibold" style={{ color: palette.muted }}>
              {form.client_name ? `${form.client_name} · ` : ''}
              {form.title}
            </span>
          </span>
          <span
            className="shrink-0 text-[13px] font-bold tabular-nums"
            style={{ color: palette.accentText }}
          >
            {mode === 'review'
              ? 'Revisão'
              : steps && !cards
                ? `${i + 1} / ${form.questions.length}`
                : `${answered} / ${form.questions.length}`}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: palette.dark ? 'rgba(255,255,255,0.1)' : '#e2e6f0' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: palette.accent }}
            initial={false}
            animate={{ width: `${(mode === 'review' ? 1 : progress) * 100}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 26 }}
          />
        </div>
        </div>
      </div>

      {editing && mode === 'fill' && previous && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-[12px] px-3.5 py-2.5 text-[13px]"
          style={{ background: `${palette.accent}14`, color: palette.accentText }}
        >
          <b className="font-bold">Corrigindo suas respostas.</b>
          <span style={{ color: palette.muted }}>
            Enviado em {fullDate(previous.submitted_at)}
            {(previous.edits ?? 0) > 0 && ` · já corrigido ${previous.edits}×`}
          </span>
        </motion.div>
      )}

      {cards ? (
        <CardsBoard
          form={form}
          answers={answers}
          errors={errors}
          palette={palette}
          editing={editing}
          onOpen={setOpenIdx}
        />
      ) : mode === 'review' ? (
        <ReviewList
          form={form}
          answers={answers}
          palette={palette}
          editing={editing}
          onEdit={editAnswer}
        />
      ) : steps ? (
        <div className="grid min-h-[50dvh] content-center">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={current.id}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <QuestionCard
                q={current}
                index={i}
                palette={palette}
                value={answers[current.id] ?? null}
                error={errors[current.id]}
                onChange={(v) => set(current.id, v)}
                onEnter={() => (last ? goReview() : go(i + 1))}
                autoFocus
              />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          {form.questions.map((q, qi) => (
            <div key={q.id} id={`pq-${q.id}`}>
              {q.section && q.section !== (form.questions[qi - 1]?.section ?? null) && (
                <div
                  className="sticky z-20 mt-7 mb-2 flex first:mt-0"
                  style={{ top: alturaTopo + 8 }}
                >
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-bold tracking-[0.07em] uppercase shadow-sm backdrop-blur-md"
                    style={{
                      background: palette.bg,
                      color: palette.accentText,
                      border: `1px solid ${palette.accent}55`,
                      boxShadow: `0 6px 18px -10px ${palette.accent}, 0 0 0 4px ${palette.canvas}`,
                    }}
                  >
                    {q.section}
                  </motion.span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <QuestionCard
                  q={q}
                  index={qi}
                  palette={palette}
                  value={answers[q.id] ?? null}
                  error={errors[q.id]}
                  onChange={(v) => set(q.id, v)}
                  hideSection
                />
              </motion.div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {fatal && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-[12px] px-4 py-3 text-[13.5px] font-semibold"
            style={{ background: '#e11d481a', color: '#e11d48' }}
          >
            {fatal}
          </motion.p>
        )}
      </AnimatePresence>

      <QuestionModal
        form={form}
        index={openIdx}
        answers={answers}
        errors={errors}
        palette={palette}
        onChange={set}
        onClose={() => setOpenIdx(null)}
        onGo={(n) => setOpenIdx(n)}
      />

      {/* ── navegação ── */}
      <div className="sticky bottom-0 z-30 mt-6">
        {/* mesma faixa de ponta a ponta do topo, para a barra não flutuar */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-[100vw] -translate-x-1/2 backdrop-blur-xl"
          style={{
            background: `${palette.canvas}d9`,
            borderTop: `1px solid ${palette.line}`,
          }}
        />
        <div className="relative flex items-center justify-between gap-3 py-4">
        {cards ? (
          <>
            <span className="text-[13px] font-medium" style={{ color: palette.muted }}>
              {answered} de {form.questions.length} respondidas
            </span>
            <Primary palette={palette} busy={sending} onClick={() => void send()}>
              {sending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Enviar respostas'}
            </Primary>
          </>
        ) : mode === 'review' ? (
          <>
            <motion.button
              type="button"
              onClick={() => {
                setMode('fill')
                setI(0)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              whileHover={{ x: -3 }}
              className="cursor-pointer rounded-[12px] px-3 py-2.5 text-[14px] font-semibold"
              style={{ color: palette.muted }}
            >
              {editing ? '← Rever pergunta por pergunta' : '← Voltar e corrigir'}
            </motion.button>
            <Primary palette={palette} busy={sending} onClick={() => void send()}>
              {sending
                ? 'Salvando…'
                : editing
                  ? 'Salvar alterações'
                  : 'Confirmar e enviar'}
            </Primary>
          </>
        ) : steps ? (
          <>
            <motion.button
              type="button"
              onClick={() => go(i - 1)}
              disabled={i === 0}
              whileHover={i === 0 ? undefined : { x: -3 }}
              className="cursor-pointer rounded-[12px] px-3 py-2.5 text-[14px] font-semibold disabled:opacity-30"
              style={{ color: palette.muted }}
            >
              ← Anterior
            </motion.button>
            <div className="flex items-center gap-2">
              {!current.required && (
                <button
                  type="button"
                  onClick={() => (last ? goReview() : go(i + 1))}
                  className="cursor-pointer rounded-[12px] px-3 py-2.5 text-[14px] font-semibold"
                  style={{ color: palette.muted }}
                >
                  Pular
                </button>
              )}
              <Primary palette={palette} onClick={() => (last ? goReview() : go(i + 1))}>
                {last ? 'Revisar respostas →' : 'Próxima →'}
              </Primary>
            </div>
          </>
        ) : (
          <>
            <span className="text-[13px] font-medium" style={{ color: palette.muted }}>
              {answered} de {form.questions.length} respondidas
            </span>
            <Primary palette={palette} onClick={goReview}>
              Revisar respostas →
            </Primary>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════ revisão antes de enviar ══════════════ */

function ReviewList({
  form,
  answers,
  palette,
  editing,
  onEdit,
}: {
  form: FormRecord
  answers: Answers
  palette: Palette
  editing: boolean
  onEdit: (index: number) => void
}) {
  const filled = form.questions.filter((q) => !!answerText(q.type, answers[q.id])).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="mb-3 overflow-hidden rounded-[16px] shadow-sm"
        style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
      >
        <div className="h-2.5 w-full" style={{ background: palette.accent }} />
        <div className="px-5 py-5 sm:px-7">
          {form.theme.logo && (
            <div className="mb-4">
              <BrandLogo src={form.theme.logo} bg={form.theme.logoBg} />
            </div>
          )}
          <p className="text-[13px] font-bold" style={{ color: palette.accentText }}>
            {editing ? 'Suas respostas' : 'Falta só conferir'}
          </p>
          <h2 className="mt-1 text-[clamp(1.4rem,4vw,1.8rem)] leading-tight font-extrabold tracking-[-0.03em]">
            {editing ? form.title : 'Confira suas respostas'}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: palette.muted }}>
            {editing
              ? 'Isto é o que você já enviou. Clique em Editar em qualquer item para corrigir — depois é só salvar.'
              : 'Dê uma olhada no que você respondeu. Clique em Editar em qualquer item para corrigir antes de enviar.'}
          </p>
          <p className="mt-3 text-[12.5px] font-semibold" style={{ color: palette.muted }}>
            {filled} de {form.questions.length} perguntas respondidas
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {form.questions.map((q, i) => {
          const text = answerText(q.type, answers[q.id])
          const vazio = !text
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}
              className="overflow-hidden rounded-[14px]"
              style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
            >
              {q.section && q.section !== (form.questions[i - 1]?.section ?? null) && (
                <p
                  className="px-4 pt-3 text-[11.5px] font-bold tracking-[0.06em] uppercase"
                  style={{ color: palette.accentText }}
                >
                  {q.section}
                </p>
              )}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className="mt-0.5 w-6 shrink-0 text-[12px] font-bold tabular-nums"
                  style={{ color: palette.muted }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold" style={{ color: palette.muted }}>
                    {q.label}
                  </span>
                  <span
                    className={cn('mt-1 block text-[15px] leading-relaxed whitespace-pre-line')}
                    style={{ color: vazio ? palette.muted : palette.fg, fontStyle: vazio ? 'italic' : undefined }}
                  >
                    {vazio ? 'não respondeu' : text}
                  </span>
                </span>
                <motion.button
                  type="button"
                  onClick={() => onEdit(i)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={spring}
                  className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                  style={{ background: `${palette.accent}16`, color: palette.accentText }}
                >
                  Editar
                </motion.button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ══════════════ modo lista: tudo numa tela ══════════════ */

function CardsBoard({
  form,
  answers,
  errors,
  palette,
  editing,
  onOpen,
}: {
  form: FormRecord
  answers: Answers
  errors: Record<string, string>
  palette: Palette
  editing: boolean
  onOpen: (i: number) => void
}) {
  const faltam = form.questions.filter(
    (q) => q.required && !answerText(q.type, answers[q.id]),
  ).length

  return (
    <div>
      <div
        className="mb-3 overflow-hidden rounded-[16px] shadow-sm"
        style={{ background: palette.bg, border: `1px solid ${palette.line}` }}
      >
        <div className="h-2.5 w-full" style={{ background: palette.accent }} />
        <div className="px-5 py-5 sm:px-7">
          {form.theme.logo && (
            <div className="mb-4">
              <BrandLogo src={form.theme.logo} bg={form.theme.logoBg} />
            </div>
          )}
          {form.client_name && (
            <p className="text-[13px] font-bold" style={{ color: palette.accentText }}>
              {form.client_name}
            </p>
          )}
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2rem)] leading-tight font-extrabold tracking-[-0.03em]">
            {form.title}
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: palette.muted }}>
            {editing
              ? 'Toque em qualquer pergunta para corrigir. No fim, salve.'
              : form.intro || 'Toque em cada pergunta para responder. No fim, é só enviar.'}
          </p>
          {faltam > 0 && (
            <p className="mt-3 text-[13px] font-bold" style={{ color: palette.accentText }}>
              {faltam === 1
                ? 'Falta 1 pergunta obrigatória'
                : `Faltam ${faltam} perguntas obrigatórias`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {form.questions.map((q, i) => {
          const text = answerText(q.type, answers[q.id])
          const err = errors[q.id]
          const novaSecao = q.section && q.section !== (form.questions[i - 1]?.section ?? null)
          return (
            <div key={q.id} id={`pq-${q.id}`}>
              {novaSecao && (
                <p
                  className="mt-6 mb-2 px-1 text-[12.5px] font-bold tracking-[0.06em] uppercase first:mt-0"
                  style={{ color: palette.accentText }}
                >
                  {q.section}
                </p>
              )}
              <motion.button
                type="button"
                onClick={() => onOpen(i)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                transition={spring}
                className="flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-[14px] px-4 py-3.5 text-left"
                style={{
                  background: palette.bg,
                  border: `1px solid ${err ? '#e11d48' : text ? palette.line : `${palette.accent}55`}`,
                  boxShadow: err ? '0 0 0 3px rgba(225,29,72,.12)' : undefined,
                }}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12.5px] font-bold"
                  style={
                    text
                      ? { background: `${palette.accent}1f`, color: palette.accentText }
                      : { background: palette.accent, color: palette.onAccent }
                  }
                >
                  {text ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="m5 12.5 4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] leading-snug font-semibold">
                    {q.label}
                    {q.required && <span className="ml-0.5 text-[#e11d48]">*</span>}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-[13.5px]"
                    style={{
                      color: text ? palette.muted : palette.accentText,
                      fontWeight: text ? 400 : 600,
                    }}
                  >
                    {text || 'Toque para responder'}
                  </span>
                  {err && (
                    <span className="mt-1 block text-[12.5px] font-semibold text-[#e11d48]">
                      {err}
                    </span>
                  )}
                </span>

                <span className="shrink-0" style={{ color: palette.muted }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </motion.button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Uma pergunta por vez, numa janelinha por cima da lista. */
function QuestionModal({
  form,
  index,
  answers,
  errors,
  palette,
  onChange,
  onClose,
  onGo,
}: {
  form: FormRecord
  index: number | null
  answers: Answers
  errors: Record<string, string>
  palette: Palette
  onChange: (id: string, v: AnswerValueT) => void
  onClose: () => void
  onGo: (i: number) => void
}) {
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [index, onClose])

  const q = index === null ? null : form.questions[index]
  const total = form.questions.length
  const last = index !== null && index === total - 1

  return (
    <AnimatePresence>
      {q && index !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0"
            style={{ background: palette.dark ? 'rgba(0,0,0,.6)' : 'rgba(22,24,31,.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[34rem] overflow-hidden rounded-t-[22px] shadow-xl sm:rounded-[20px]"
            style={{ background: palette.bg, color: palette.fg }}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.16 } }}
            transition={spring}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid ${palette.line}` }}
            >
              <span className="text-[12.5px] font-bold" style={{ color: palette.accentText }}>
                Pergunta {index + 1} de {total}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full"
                style={{ color: palette.muted }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="max-h-[70dvh] overflow-auto px-5 py-5 sm:px-7">
              <h2 className="text-[clamp(1.15rem,3.4vw,1.4rem)] leading-snug font-bold tracking-[-0.02em]">
                {q.label}
                {q.required && <span className="ml-0.5 text-[#e11d48]">*</span>}
              </h2>
              {q.description && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: palette.muted }}>
                  {q.description}
                </p>
              )}

              <div className="mt-4">
                <AnswerField
                  key={q.id}
                  q={q}
                  value={answers[q.id] ?? null}
                  onChange={(v) => onChange(q.id, v)}
                  palette={palette}
                  invalid={!!errors[q.id]}
                  autoFocus
                  onEnter={() => (last ? onClose() : onGo(index + 1))}
                />
              </div>

              {errors[q.id] && (
                <p className="mt-2.5 text-[13px] font-semibold text-[#e11d48]">{errors[q.id]}</p>
              )}
            </div>

            <div
              className="flex items-center justify-between gap-2 px-5 py-3.5"
              style={{ borderTop: `1px solid ${palette.line}`, background: palette.canvas }}
            >
              <button
                type="button"
                onClick={() => onGo(index - 1)}
                disabled={index === 0}
                className="cursor-pointer rounded-[10px] px-3 py-2 text-[14px] font-semibold disabled:opacity-30"
                style={{ color: palette.muted }}
              >
                ← Anterior
              </button>
              <Primary palette={palette} onClick={() => (last ? onClose() : onGo(index + 1))}>
                {last ? 'Concluir' : 'Próxima →'}
              </Primary>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function Primary({
  palette,
  children,
  onClick,
  busy,
}: {
  palette: Palette
  children: React.ReactNode
  onClick: () => void
  busy?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="cursor-pointer rounded-[12px] px-6 py-3 text-[15px] font-bold shadow-sm disabled:opacity-55"
      style={{ background: palette.accent, color: palette.onAccent }}
      whileHover={busy ? undefined : { y: -2, boxShadow: `0 12px 24px -10px ${palette.accent}` }}
      whileTap={{ scale: 0.98, y: 0 }}
      transition={spring}
    >
      {children}
    </motion.button>
  )
}

/* ── campo de resposta, com a saída "não tenho" ────────── */

/**
 * O cliente trava quando a pergunta não se aplica a ele — não tem site,
 * não tem Instagram, não quer passar o CPF. Em vez de deixar em branco
 * (que vira cobrança depois), ele marca "Não tenho" e segue.
 */
function AnswerField({
  q,
  value,
  palette,
  invalid,
  autoFocus,
  onChange,
  onEnter,
}: {
  q: Question
  value: AnswerValueT
  palette: Palette
  invalid?: boolean
  autoFocus?: boolean
  onChange: (v: AnswerValueT) => void
  onEnter?: () => void
}) {
  const skipped = isSkipped(value)

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {skipped ? (
          <motion.div
            key="skip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="flex items-center gap-3 rounded-[13px] px-4 py-3.5"
            style={{ background: `${palette.accent}14`, border: `1px dashed ${palette.accent}66` }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: palette.accent, color: palette.onAccent }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{SKIP_ANSWER}</span>
              <span className="block text-[12.5px] leading-snug" style={{ color: palette.muted }}>
                Vamos registrar que isso não se aplica a você.
              </span>
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 cursor-pointer rounded-[9px] px-2.5 py-1.5 text-[13px] font-bold underline-offset-2 hover:underline"
              style={{ color: palette.accentText }}
            >
              Responder
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="campo"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
          >
            <AnswerInput
              q={q}
              value={value}
              onChange={onChange}
              palette={palette}
              invalid={invalid}
              autoFocus={autoFocus}
              onEnter={onEnter}
            />

            <motion.button
              type="button"
              onClick={() => onChange(SKIP_ANSWER)}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="mt-3 flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors"
              style={{ color: palette.muted, border: `1px solid ${palette.line}` }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Não tenho / não quero informar
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QuestionCard({
  q,
  index,
  palette,
  value,
  error,
  onChange,
  onEnter,
  autoFocus,
  hideSection,
}: {
  q: Question
  index: number
  palette: Palette
  value: AnswerValueT
  error?: string
  onChange: (v: AnswerValueT) => void
  onEnter?: () => void
  autoFocus?: boolean
  /** a etiqueta do bloco já está grudada no topo — não repete aqui */
  hideSection?: boolean
}) {
  // Numa página com 30 perguntas iguais, o que orienta é saber onde você
  // está e o que já ficou para trás.
  const respondida = !!answerText(q.type, value)

  return (
    <div
      className="group relative overflow-hidden rounded-[16px] shadow-sm transition-[box-shadow,border-color,transform] duration-200 focus-within:-translate-y-0.5"
      style={{
        background: palette.bg,
        border: `1px solid ${error ? '#e11d48' : palette.line}`,
      }}
    >
      {/* barra lateral: apagada enquanto está em branco, cheia quando responde */}
      <motion.span
        className="absolute inset-y-0 left-0 w-[5px]"
        style={{ background: error ? '#e11d48' : palette.accent }}
        animate={{ opacity: error ? 1 : respondida ? 0.95 : 0.3 }}
        transition={{ duration: 0.3 }}
      />
      {/* brilho de foco: o cartão em que a pessoa está digitando se destaca */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 transition-opacity duration-200 group-focus-within:opacity-100"
        style={{ boxShadow: `0 0 0 2px ${palette.accent}55, 0 14px 32px -18px ${palette.accent}` }}
      />

      <div className="relative px-5 py-5 pl-6 sm:px-7 sm:pl-8">
        <div className="flex items-baseline gap-2">
          <span
            className="flex items-center gap-1 text-[12.5px] font-bold tabular-nums"
            style={{ color: palette.accentText }}
          >
            {String(index + 1).padStart(2, '0')}
            <AnimatePresence>
              {respondida && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={spring}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </span>
          {q.section && !hideSection && (
            <span className="text-[12px] font-semibold" style={{ color: palette.muted }}>
              {q.section}
            </span>
          )}
        </div>

        <h2 className="mt-1.5 text-[clamp(1.12rem,2.6vw,1.35rem)] leading-snug font-bold tracking-[-0.02em]">
          {q.label}
          {q.required && <span className="ml-0.5 text-[#e11d48]">*</span>}
        </h2>

        {q.description && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: palette.muted }}>
            {q.description}
          </p>
        )}

        <div className="mt-4">
          <AnswerField
            q={q}
            value={value}
            onChange={onChange}
            palette={palette}
            invalid={!!error}
            autoFocus={autoFocus}
            onEnter={onEnter}
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#e11d48]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.1" fill="currentColor" />
              </svg>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ══════════════ enviado ══════════════ */

function Sent({
  palette,
  form,
  mode,
  onEditAgain,
}: {
  palette: Palette
  form: FormRecord
  mode: SubmitMode
  onEditAgain: () => void
}) {
  const scope = useRef<HTMLDivElement>(null)
  const updated = mode === 'updated'

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-s]', {
        y: 24,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        delay: 0.35,
        ease: 'expo.out',
      })
    }, scope)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={scope} className="mt-[10dvh]">
      <Card palette={palette} topBar>
        <div className="px-6 py-10 text-center sm:px-10">
          {form.theme.logo && (
            <div className="mb-7 flex justify-center">
              <BrandLogo src={form.theme.logo} bg={form.theme.logoBg} />
            </div>
          )}
          <div className="flex justify-center">
            <CheckBurst color={palette.accent} size={96} />
          </div>

          <h1 data-s className="mt-6 text-[clamp(1.7rem,5vw,2.2rem)] leading-tight font-extrabold tracking-[-0.035em]">
            {updated ? 'Alterações salvas!' : 'Respostas enviadas!'}
          </h1>

          <p
            data-s
            className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed"
            style={{ color: palette.muted }}
          >
            {updated
              ? 'Suas correções foram gravadas. Pode fechar a página — ou abrir de novo quando quiser.'
              : form.outro ||
                'Recebemos tudo certinho. Qualquer coisa a gente volta a falar com você por aqui mesmo.'}
          </p>

          {form.allow_edit && (
            <motion.button
              data-s
              type="button"
              onClick={onEditAgain}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="mt-6 cursor-pointer rounded-[12px] border-2 px-5 py-2.5 text-[14px] font-bold"
              style={{ borderColor: palette.line, color: palette.accentText }}
            >
              Corrigir alguma resposta
            </motion.button>
          )}

          <div
            data-s
            className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: `${palette.accent}14`, color: palette.accentText }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {form.client_name || form.title} · {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </Card>
    </div>
  )
}
