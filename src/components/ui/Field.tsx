import { motion } from 'motion/react'
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/utils'
import { springPop } from '../../lib/anim'

/* ── Rótulo + dica + erro ───────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
  action,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={className}>
      {(label || action) && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13.5px] font-semibold text-ink-2">
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {(hint || error) && (
        <motion.p
          initial={false}
          animate={{ opacity: 1 }}
          className={cn(
            'mt-1.5 text-[12.5px] leading-snug',
            error ? 'font-medium text-danger' : 'text-ink-3',
          )}
        >
          {error ?? hint}
        </motion.p>
      )}
    </div>
  )
}

/* ── Base dos controles ─────────────────────────────────── */

const CONTROL =
  'w-full rounded-[12px] border bg-surface px-3.5 text-[15px] text-ink outline-none ' +
  'transition-[border-color,box-shadow,background] duration-200 ' +
  'placeholder:text-ink-4'

const IDLE = 'border-line hover:border-ink-4'
const FOCUS = 'border-brand shadow-[0_0_0_4px_var(--color-brand-soft)]'
const INVALID = 'border-danger shadow-[0_0_0_4px_var(--color-danger-soft)]'

function ring(focus: boolean, invalid?: boolean) {
  return invalid ? INVALID : focus ? FOCUS : IDLE
}

/* ── Input ──────────────────────────────────────────────── */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  invalid?: boolean
  prefix?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, prefix, suffix, onFocus, onBlur, ...rest },
  ref,
) {
  const [focus, setFocus] = useState(false)
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-[12px] border bg-surface pr-1.5 pl-3.5',
        'transition-[border-color,box-shadow] duration-200',
        ring(focus, invalid),
        className,
      )}
    >
      {prefix && <span className="shrink-0 text-[14px] text-ink-3">{prefix}</span>}
      <input
        ref={ref}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-4"
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      {suffix && <span className="shrink-0 text-[13px] text-ink-3">{suffix}</span>}
    </div>
  )
})

/* ── Textarea ───────────────────────────────────────────── */

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, onFocus, onBlur, rows = 3, ...rest }, ref) {
  const [focus, setFocus] = useState(false)
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', ring(focus, invalid), className)}
      onFocus={(e) => {
        setFocus(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocus(false)
        onBlur?.(e)
      }}
      {...rest}
    />
  )
})

/* ── Select ─────────────────────────────────────────────── */

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, onFocus, onBlur, children, ...rest }, ref) {
  const [focus, setFocus] = useState(false)
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL,
          'h-11 cursor-pointer appearance-none pr-10',
          ring(focus, invalid),
          className,
        )}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        {...rest}
      >
        {children}
      </select>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-3"
        animate={{ rotate: focus ? 180 : 0 }}
        transition={springPop}
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path
            d="M1 1.5 6 6.5l5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.span>
    </div>
  )
})

/* ── Switch ─────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div
      className="flex cursor-pointer items-start gap-3 select-none"
      onClick={() => onChange(!checked)}
    >
      <motion.button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={cn(
          'relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full p-[3px] transition-colors duration-200',
          checked ? 'bg-brand' : 'bg-canvas-2',
        )}
        whileTap={{ scale: 0.94 }}
        onClick={(e) => {
          e.stopPropagation()
          onChange(!checked)
        }}
      >
        <motion.span
          className="block h-5 w-5 rounded-full bg-white shadow-sm"
          animate={{ x: checked ? 20 : 0 }}
          transition={springPop}
        />
      </motion.button>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-ink-3">{hint}</span>}
      </span>
    </div>
  )
}

/* ── Grupo de botões (segmented) ────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  id: string
}) {
  return (
    <div className="inline-flex rounded-[12px] border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative cursor-pointer rounded-[9px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[9px] bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
