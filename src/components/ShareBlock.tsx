import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { cn, copy } from '../lib/utils'
import { Button } from './ui/Button'
import { useToast } from './ui/Feedback'
import { spring, springPop } from '../lib/anim'

/** O texto que vai para o WhatsApp/e-mail do cliente. */
export function shareText(url: string, password?: string | null): string {
  return password ? `Link:\n${url}\n\nSenha:\n${password}` : `Link:\n${url}`
}

/**
 * Bloco "para mandar ao cliente": link e senha um embaixo do outro,
 * cada um com cópia própria, mais um botão que copia os dois já formatados.
 */
export default function ShareBlock({
  url,
  password,
  accent,
  className,
  compact,
  flat,
}: {
  url: string
  password?: string | null
  /** cor do formulário, para o bloco combinar com ele */
  accent?: string
  className?: string
  compact?: boolean
  /** sem borda/cantos próprios, para encaixar dentro de outro cartão */
  flat?: boolean
}) {
  const toast = useToast()
  const [copied, setCopied] = useState<'all' | 'url' | 'password' | null>(null)

  const brand = accent ?? 'var(--color-brand)'

  async function grab(what: 'all' | 'url' | 'password', text: string, label: string) {
    const ok = await copy(text)
    if (!ok) return toast('Não consegui copiar.', 'error')
    setCopied(what)
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800)
    toast(label)
  }

  return (
    <div
      className={cn(
        'overflow-hidden bg-surface',
        flat ? 'border-t border-line' : 'rounded-[16px] border border-line',
        className,
      )}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3"
        style={{ background: `color-mix(in srgb, ${brand} 9%, #fff)` }}
      >
        <span className="text-[12.5px] font-bold" style={{ color: brand }}>
          Para mandar ao cliente
        </span>
        <Button
          size="sm"
          onClick={() =>
            grab(
              'all',
              shareText(url, password),
              password ? 'Link e senha copiados.' : 'Link copiado.',
            )
          }
          className="shrink-0"
          style={{ background: brand }}
          icon={<CopyMark done={copied === 'all'} />}
        >
          {copied === 'all' ? 'Copiado!' : password ? 'Copiar link e senha' : 'Copiar link'}
        </Button>
      </div>

      <Row
        label="Link"
        value={url}
        mono
        done={copied === 'url'}
        onCopy={() => grab('url', url, 'Link copiado.')}
      />

      {password && (
        <Row
          label="Senha"
          value={password}
          mono
          highlight={brand}
          done={copied === 'password'}
          onCopy={() => grab('password', password, 'Senha copiada.')}
        />
      )}

      {!compact && (
        <p className="border-t border-line-2 bg-surface-2 px-4 py-2.5 text-[12.5px] text-ink-3">
          {password
            ? 'O botão copia link e senha já formatados, um embaixo do outro — é só colar.'
            : 'Esse link abre direto, sem senha.'}
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  highlight,
  done,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: string
  done: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-3">
      <span className="w-12 shrink-0 text-[12.5px] font-semibold text-ink-3">{label}</span>
      <button
        type="button"
        onClick={onCopy}
        title="Clique para copiar"
        className={cn(
          'min-w-0 flex-1 cursor-pointer truncate rounded-[8px] px-2 py-1 text-left text-[14px] transition-colors hover:bg-canvas-2',
          mono && 'font-mono text-[13.5px]',
        )}
        style={highlight ? { color: highlight, fontWeight: 700 } : undefined}
      >
        {value}
      </button>
      <motion.button
        type="button"
        onClick={onCopy}
        aria-label={`Copiar ${label.toLowerCase()}`}
        title={`Copiar ${label.toLowerCase()}`}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        transition={spring}
        className={cn(
          'grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
          done ? 'bg-ok-soft text-ok' : 'text-ink-3 hover:bg-canvas-2 hover:text-ink',
        )}
      >
        <CopyMark done={done} />
      </motion.button>
    </div>
  )
}

function CopyMark({ done }: { done: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.svg
          key="done"
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={springPop}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      ) : (
        <motion.svg
          key="copy"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.14 }}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
        >
          <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
          <path
            d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </motion.svg>
      )}
    </AnimatePresence>
  )
}
