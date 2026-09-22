import { AnimatePresence, motion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { spring, springPop } from '../../lib/anim'

/* ══════════════ Toasts ══════════════ */

type Tone = 'ok' | 'error' | 'info'
interface Toast {
  id: number
  text: string
  tone: Tone
}

const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

const TOAST_ICON: Record<Tone, ReactNode> = {
  ok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 7v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.3" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 11v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  ),
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-2), { id, text, tone }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  const tones: Record<Tone, string> = {
    ok: 'bg-ink text-white',
    error: 'bg-danger text-white',
    info: 'bg-ink text-white',
  }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.94, transition: { duration: 0.18 } }}
              transition={springPop}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-[14px] px-4 py-3',
                'text-[14px] font-medium shadow-lg',
                tones[t.tone],
              )}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20">
                {TOAST_ICON[t.tone]}
              </span>
              <span className="flex-1 leading-snug">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/* ══════════════ Modal ══════════════ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative w-full overflow-hidden rounded-xl2 border border-line bg-surface shadow-xl',
              width,
            )}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
            transition={spring}
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div>
                <h3 className="text-[18px] font-bold tracking-[-0.02em]">{title}</h3>
                {description && <p className="mt-1 text-[13.5px] text-ink-3">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mt-1 -mr-1.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-canvas-2 hover:text-ink"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            <div className="px-6 pb-6">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ══════════════ Confirmação ══════════════ */

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirmar',
  danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14.5px] leading-relaxed text-ink-2">{body}</p>
    </Modal>
  )
}

/* ══════════════ Esqueleto ══════════════ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-[10px]', className)} />
}

export function useCopyFlash() {
  const [hit, setHit] = useState(false)
  const flash = useMemo(
    () => () => {
      setHit(true)
      setTimeout(() => setHit(false), 1400)
    },
    [],
  )
  return [hit, flash] as const
}
