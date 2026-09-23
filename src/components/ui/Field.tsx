import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
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

/* ── Switch ─────────────────────────────────────────────── */

/* ── Seletor ─────────────────────────────────────────────
   O <select> do sistema abre uma lista desenhada pelo sistema
   operacional: fonte cinza, cantos retos, sem espaço para explicar cada
   opção. Este abre um painel próprio, com a descrição de cada item ao
   lado do nome, e responde a teclado igual ao nativo.
*/

export interface PickerItem<T extends string> {
  value: T
  label: string
  /** explicação curta ao lado do nome */
  hint?: string
  /** separa grupos na lista */
  group?: string
}

export function Picker<T extends string>({
  value,
  items,
  onChange,
  placeholder = 'Selecione…',
  invalid,
  className,
  id,
}: {
  value: T | ''
  items: PickerItem<T>[]
  onChange: (v: T) => void
  placeholder?: string
  invalid?: boolean
  className?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  /*
    O painel sai para o corpo da página. Dentro do cartão da pergunta ele
    ficava cortado: o cartão tem overflow escondido por causa da animação
    de abrir e fechar, e levava metade da lista junto.
  */
  const [caixa, setCaixa] = useState<{ left: number; top: number; width: number } | null>(null)

  const medir = useCallback(() => {
    const el = botaoRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const alturaMax = 320
    const cabeEmbaixo = window.innerHeight - r.bottom > alturaMax + 16
    setCaixa({
      left: r.left,
      top: cabeEmbaixo ? r.bottom + 6 : Math.max(8, r.top - alturaMax - 6),
      width: r.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    medir()
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [open, medir])

  const atual = items.find((i) => i.value === value) ?? null
  const indiceAtual = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  )

  useEffect(() => {
    if (open) setCursor(indiceAtual)
  }, [open, indiceAtual])

  // clique fora fecha
  useEffect(() => {
    if (!open) return
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node
      // o painel vive fora desta árvore agora: sem checá-lo, o clique numa
      // opção fechava a lista antes de a escolha chegar
      if (boxRef.current?.contains(alvo) || listRef.current?.contains(alvo)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [open])

  // mantém o item do cursor à vista
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-i="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, cursor])

  function teclado(e: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(items.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setCursor(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setCursor(items.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const escolhido = items[cursor]
      if (escolhido) {
        onChange(escolhido.value)
        setOpen(false)
      }
    }
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <button
        ref={botaoRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={teclado}
        className={cn(
          CONTROL,
          'flex h-11 cursor-pointer items-center gap-2 pr-10 text-left',
          ring(open, invalid),
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !atual && 'text-ink-4')}>
          {atual ? atual.label : placeholder}
        </span>
        {atual?.hint && (
          <span className="hidden shrink-0 text-[12.5px] text-ink-3 sm:block">{atual.hint}</span>
        )}
      </button>

      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-3"
        animate={{ rotate: open ? 180 : 0 }}
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

      {createPortal(
        <AnimatePresence>
          {open && caixa && (
            <motion.div
              ref={listRef}
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
              transition={springPop}
              style={{ left: caixa.left, top: caixa.top, width: caixa.width }}
              className="fixed z-[60] max-h-[20rem] origin-top overflow-auto rounded-[14px] border border-line bg-surface p-1.5 shadow-lg"
            >
            {items.map((item, i) => {
              const on = item.value === value
              const sob = i === cursor
              const abreGrupo = item.group && item.group !== items[i - 1]?.group
              return (
                <div key={item.value}>
                  {abreGrupo && (
                    <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-i={i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors',
                      sob && 'bg-canvas-2',
                      on && 'bg-brand-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[14px]',
                        on ? 'font-bold text-brand' : 'font-medium text-ink',
                      )}
                    >
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="shrink-0 text-[12px] text-ink-3">{item.hint}</span>
                    )}
                    {on && (
                      <motion.svg
                        layoutId={`picker-${id ?? 'x'}`}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="shrink-0 text-brand"
                      >
                        <path
                          d="m5 12.5 4.5 4.5L19 7.5"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </motion.svg>
                    )}
                  </button>
                </div>
              )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

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
