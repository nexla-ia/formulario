import { motion, type HTMLMotionProps } from 'motion/react'
import { forwardRef, useCallback, useRef, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { spring } from '../../lib/anim'

type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden ' +
  'font-semibold leading-none whitespace-nowrap transition-colors duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-45 cursor-pointer'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  soft: 'bg-brand-soft text-brand hover:bg-brand-line/70',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2 hover:border-ink-4 shadow-xs',
  ghost: 'bg-transparent text-ink-2 hover:bg-canvas-2 hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
  dark: 'bg-ink text-white hover:bg-ink-2 shadow-sm',
}

const SIZE: Record<Size, string> = {
  sm: 'h-9 rounded-[10px] px-3.5 text-[13px]',
  md: 'h-11 rounded-[12px] px-5 text-[14px]',
  lg: 'h-[52px] rounded-[14px] px-7 text-[15.5px]',
}

/** Cor da ondulação por variante. */
const RIPPLE: Record<Variant, string> = {
  primary: 'rgba(255,255,255,0.55)',
  soft: 'rgba(86,70,245,0.28)',
  outline: 'rgba(86,70,245,0.18)',
  ghost: 'rgba(86,70,245,0.16)',
  danger: 'rgba(225,29,72,0.3)',
  dark: 'rgba(255,255,255,0.4)',
}

/** Ondulação estilo Material a partir do ponto clicado. */
export function useRipple(color: string) {
  const host = useRef<HTMLElement | null>(null)
  const fire = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const el = host.current ?? (e.currentTarget as HTMLElement)
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const dot = document.createElement('span')
      dot.className = 'ripple-dot'
      dot.style.width = dot.style.height = `${size}px`
      dot.style.left = `${e.clientX - rect.left - size / 2}px`
      dot.style.top = `${e.clientY - rect.top - size / 2}px`
      dot.style.background = color
      el.appendChild(dot)
      window.setTimeout(() => dot.remove(), 650)
    },
    [color],
  )
  return { host, fire }
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    block,
    icon,
    className,
    children,
    disabled,
    onPointerDown,
    ...rest
  },
  ref,
) {
  const { host, fire } = useRipple(RIPPLE[variant])

  return (
    <motion.button
      ref={(node) => {
        host.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      disabled={disabled || loading}
      className={cn(BASE, VARIANT[variant], SIZE[size], block && 'w-full', className)}
      whileHover={disabled || loading ? undefined : { y: -1.5 }}
      whileTap={disabled || loading ? undefined : { scale: 0.975, y: 0 }}
      transition={spring}
      onPointerDown={(e) => {
        if (!disabled && !loading) fire(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </motion.button>
  )
})

function Spinner() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-[15px] w-[15px] rounded-full border-[2px] border-current border-t-transparent opacity-80"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
    />
  )
}

/* ── Botão só de ícone ──────────────────────────────────── */

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  label: string
  children?: ReactNode
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md'
}

export function IconButton({
  label,
  children,
  className,
  tone = 'default',
  size = 'md',
  onPointerDown,
  ...rest
}: IconButtonProps) {
  const { host, fire } = useRipple(
    tone === 'danger' ? 'rgba(225,29,72,0.26)' : 'rgba(86,70,245,0.18)',
  )
  return (
    <motion.button
      ref={host as never}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full',
        'text-ink-3 transition-colors duration-150',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        tone === 'danger' ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-canvas-2 hover:text-ink',
        className,
      )}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={spring}
      onPointerDown={(e) => {
        fire(e)
        onPointerDown?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
