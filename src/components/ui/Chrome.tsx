import { motion } from 'motion/react'
import { animate, stagger } from 'animejs'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { springPop } from '../../lib/anim'

/* ── Marca ──────────────────────────────────────────────── */

/** Fundo da própria logo da Nexla — o quadradinho encosta nela. */
export const BRAND_BG = '#11111f'

export function Logo({
  size = 'md',
  invert,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  invert?: boolean
  className?: string
}) {
  const box = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const word = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[15px]' : 'text-[17px]'
  return (
    <span className={cn('group inline-flex items-center gap-2.5', className)}>
      <motion.span
        className={cn(
          'grid shrink-0 place-items-center rounded-[11px] bg-brand text-white shadow-sm',
          box,
        )}
        whileHover={{ rotate: -8, scale: 1.06 }}
        transition={springPop}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="5" width="16" height="2.6" rx="1.3" fill="currentColor" />
          <rect x="4" y="10.7" width="16" height="2.6" rx="1.3" fill="currentColor" opacity=".68" />
          <rect x="4" y="16.4" width="9" height="2.6" rx="1.3" fill="currentColor" opacity=".42" />
        </svg>
      </motion.span>
      <span
        className={cn(
          'font-extrabold tracking-[-0.03em]',
          word,
          invert ? 'text-white' : 'text-ink',
        )}
      >
        Formulários
      </span>
    </span>
  )
}

/* ── Pílula ─────────────────────────────────────────────── */

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'danger'
  className?: string
  dot?: boolean
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-canvas-2 text-ink-2',
    brand: 'bg-brand-soft text-brand',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  }
  const dots: Record<string, string> = {
    neutral: 'bg-ink-3',
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

/* ── Título de seção ────────────────────────────────────── */

export function SectionTitle({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/* ── Número que conta (anime.js) ────────────────────────── */

export function CountUp({
  value,
  duration = 1100,
  delay = 0,
  className,
  pad,
}: {
  value: number
  duration?: number
  delay?: number
  className?: string
  pad?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const format = (n: number) => (pad ? String(n).padStart(2, '0') : String(n))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = format(value)
      return
    }
    const state = { n: 0 }
    const anim = animate(state, {
      n: value,
      duration,
      delay,
      ease: 'outExpo',
      onUpdate: () => {
        el.textContent = format(Math.round(state.n))
      },
      onComplete: () => {
        el.textContent = format(value)
      },
    })
    return () => {
      anim.pause()
    }
  }, [value, duration, delay, pad])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {pad ? '00' : '0'}
    </span>
  )
}

/* ── Estado vazio ───────────────────────────────────────── */

export function Empty({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-16 text-center"
    >
      <div className="float-slow mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[20px] bg-brand-soft text-brand">
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="3.5"
              y="3.5"
              width="17"
              height="17"
              rx="4.5"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M8 12h8M12 8v8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <p className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-3">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </motion.div>
  )
}

/* ── Faixa rolando ──────────────────────────────────────── */

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const line = [...items, ...items]
  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="animate-marquee flex w-max items-center gap-7">
        {line.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-7 text-[13px] font-medium whitespace-nowrap text-white/45"
          >
            {t}
            <span className="h-1 w-1 rounded-full bg-white/30" />
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Tique animado (anime.js desenha o traço) ───────────── */

export function CheckBurst({ color = '#0d9f6e', size = 84 }: { color?: string; size?: number }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const ring = root.querySelector<SVGCircleElement>('[data-ring]')
    const tick = root.querySelector<SVGPathElement>('[data-tick]')
    const rays = root.querySelectorAll<SVGLineElement>('[data-ray]')
    if (!ring || !tick) return

    const ringLen = ring.getTotalLength()
    const tickLen = tick.getTotalLength()
    ring.style.strokeDasharray = `${ringLen}`
    tick.style.strokeDasharray = `${tickLen}`
    ring.style.strokeDashoffset = `${ringLen}`
    tick.style.strokeDashoffset = `${tickLen}`

    const a1 = animate(ring, { strokeDashoffset: 0, duration: 620, ease: 'outQuart' })
    const a2 = animate(tick, { strokeDashoffset: 0, duration: 420, delay: 380, ease: 'outQuart' })
    const a3 = animate(rays, {
      opacity: [0, 1, 0],
      scale: [0.4, 1.35],
      duration: 760,
      delay: stagger(34, { start: 520 }),
      ease: 'outCubic',
    })
    return () => {
      a1.pause()
      a2.pause()
      a3.pause()
    }
  }, [])

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className="overflow-visible"
    >
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2
        const x = 50 + Math.cos(angle) * 44
        const y = 50 + Math.sin(angle) * 44
        const x2 = 50 + Math.cos(angle) * 56
        const y2 = 50 + Math.sin(angle) * 56
        return (
          <line
            key={i}
            data-ray
            x1={x}
            y1={y}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="3.4"
            strokeLinecap="round"
            opacity="0"
            style={{ transformOrigin: '50px 50px' }}
          />
        )
      })}
      <circle
        data-ring
        cx="50"
        cy="50"
        r="34"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <path
        data-tick
        d="M34 51.5 45 62l21-23"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
