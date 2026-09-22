import { AnimatePresence, motion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import type { Question } from '../lib/types'
import { cn, maskPhone } from '../lib/utils'
import { spring, springPop } from '../lib/anim'

export type AnswerValueT = string | number | string[] | boolean | null

export interface Palette {
  /** fundo do cartão */
  bg: string
  /** fundo da página */
  canvas: string
  fg: string
  muted: string
  line: string
  accent: string
  /** legível por cima de `accent` */
  onAccent: string
  /** `accent` ajustado para virar texto sobre `bg` */
  accentText: string
  dark: boolean
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function AnswerInput({
  q,
  value,
  onChange,
  palette,
  invalid,
  autoFocus,
  onEnter,
}: {
  q: Question
  value: AnswerValueT
  onChange: (v: AnswerValueT) => void
  palette: Palette
  invalid?: boolean
  autoFocus?: boolean
  onEnter?: () => void
}) {
  const p = palette
  const [focus, setFocus] = useState(false)

  const borderColor = invalid ? '#e11d48' : focus ? p.accent : p.line
  const fieldStyle: CSSProperties = {
    color: p.fg,
    borderColor,
    background: p.dark ? 'rgba(255,255,255,0.03)' : '#fff',
    boxShadow: focus ? `0 0 0 4px ${p.accent}22` : 'none',
  }

  const base =
    'w-full rounded-[12px] border px-3.5 py-3 text-[15.5px] outline-none ' +
    'transition-[border-color,box-shadow] duration-200'

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  const focusProps = {
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  }

  switch (q.type) {
    case 'textarea':
      return (
        <textarea
          autoFocus={autoFocus}
          rows={4}
          className={cn(base, 'resize-y leading-relaxed')}
          style={fieldStyle}
          placeholder={q.placeholder ?? 'Escreva aqui…'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          {...focusProps}
        />
      )

    case 'number':
    case 'date':
    case 'email':
    case 'url':
    case 'text':
    case 'phone': {
      const type =
        q.type === 'number'
          ? 'number'
          : q.type === 'date'
            ? 'date'
            : q.type === 'email'
              ? 'email'
              : 'text'
      return (
        <input
          autoFocus={autoFocus}
          type={type}
          inputMode={q.type === 'phone' ? 'tel' : q.type === 'number' ? 'decimal' : undefined}
          className={base}
          style={fieldStyle}
          placeholder={q.placeholder ?? placeholderFor(q.type)}
          value={value == null ? '' : String(value)}
          onKeyDown={onKey}
          onChange={(e) => onChange(q.type === 'phone' ? maskPhone(e.target.value) : e.target.value)}
          {...focusProps}
        />
      )
    }

    case 'select':
      return (
        <div className="relative">
          <select
            autoFocus={autoFocus}
            className={cn(base, 'cursor-pointer appearance-none pr-10')}
            style={fieldStyle}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            {...focusProps}
          >
            <option value="" style={{ color: '#111' }}>
              Selecione…
            </option>
            {q.options.map((o) => (
              <option key={o} value={o} style={{ color: '#111' }}>
                {o}
              </option>
            ))}
          </select>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
            style={{ color: p.muted }}
            animate={{ rotate: focus ? 180 : 0 }}
            transition={springPop}
          >
            <svg width="13" height="9" viewBox="0 0 12 8" fill="none">
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

    case 'radio':
    case 'checkbox': {
      const multi = q.type === 'checkbox'
      const selected: string[] = multi
        ? Array.isArray(value)
          ? value
          : []
        : typeof value === 'string' && value
          ? [value]
          : []

      const toggle = (opt: string) => {
        if (!multi) return onChange(opt)
        onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt])
      }

      return (
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const on = selected.includes(opt)
            return (
              <motion.button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left text-[15px] leading-snug"
                style={{
                  borderColor: on ? p.accent : p.line,
                  background: on ? `${p.accent}14` : 'transparent',
                  color: p.fg,
                }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
              >
                <span
                  className={cn(
                    'relative grid h-[22px] w-[22px] shrink-0 place-items-center border-2',
                    multi ? 'rounded-[7px]' : 'rounded-full',
                  )}
                  style={{
                    borderColor: on ? p.accent : p.line,
                    background: on ? p.accent : 'transparent',
                  }}
                >
                  <AnimatePresence>
                    {on &&
                      (multi ? (
                        <motion.svg
                          key="c"
                          initial={{ scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={springPop}
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{ color: p.onAccent }}
                        >
                          <path
                            d="m5 12.5 4.5 4.5L19 7.5"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      ) : (
                        <motion.span
                          key="d"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={springPop}
                          className="h-[9px] w-[9px] rounded-full"
                          style={{ background: p.onAccent }}
                        />
                      ))}
                  </AnimatePresence>
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
                <span
                  className="shrink-0 text-[12px] font-bold opacity-40"
                  style={{ color: p.muted }}
                >
                  {LETTERS[i] ?? i + 1}
                </span>
              </motion.button>
            )
          })}
        </div>
      )
    }

    case 'yesno':
      return (
        <div className="flex gap-3">
          {[
            ['Sim', true],
            ['Não', false],
          ].map(([label, val]) => {
            const on = value === val
            return (
              <motion.button
                key={String(label)}
                type="button"
                onClick={() => onChange(val as boolean)}
                className="flex-1 cursor-pointer rounded-[12px] border-2 px-4 py-3.5 text-[15px] font-bold"
                style={{
                  borderColor: on ? p.accent : p.line,
                  background: on ? p.accent : 'transparent',
                  color: on ? p.onAccent : p.fg,
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                {label as string}
              </motion.button>
            )
          })}
        </div>
      )

    case 'rating': {
      const n = typeof value === 'number' ? value : 0
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <motion.button
              key={s}
              type="button"
              aria-label={`${s} de 5`}
              onClick={() => onChange(s === n ? null : s)}
              className="cursor-pointer p-1"
              whileHover={{ scale: 1.2, rotate: -8 }}
              whileTap={{ scale: 0.88 }}
              transition={springPop}
            >
              <motion.svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                animate={{ scale: s <= n ? 1 : 0.92 }}
                transition={springPop}
                fill={s <= n ? p.accent : 'none'}
                stroke={s <= n ? p.accent : p.line}
                strokeWidth="1.8"
              >
                <path
                  d="m12 3.2 2.7 5.6 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.3 9.7l6-.9L12 3.2Z"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </motion.button>
          ))}
          <span className="ml-2.5 text-[13px] font-medium" style={{ color: p.muted }}>
            {n ? `${n} de 5` : 'sem nota'}
          </span>
        </div>
      )
    }

    case 'scale': {
      const n = typeof value === 'number' ? value : null
      return (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map((i) => {
              const on = n === i
              return (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => onChange(on ? null : i)}
                  className="h-11 w-11 cursor-pointer rounded-[11px] border text-[14.5px] font-bold tabular-nums"
                  style={{
                    borderColor: on ? p.accent : p.line,
                    background: on ? p.accent : 'transparent',
                    color: on ? p.onAccent : p.fg,
                  }}
                  whileHover={{ y: -3, scale: 1.04 }}
                  whileTap={{ scale: 0.93 }}
                  transition={spring}
                >
                  {i}
                </motion.button>
              )
            })}
          </div>
          <div
            className="mt-2 flex justify-between text-[12.5px] font-medium"
            style={{ color: p.muted }}
          >
            <span>0 · nada</span>
            <span>10 · muito</span>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

function placeholderFor(t: Question['type']): string {
  switch (t) {
    case 'email':
      return 'nome@empresa.com'
    case 'phone':
      return '(11) 99999-0000'
    case 'url':
      return 'https://'
    case 'number':
      return '0'
    default:
      return 'Escreva aqui…'
  }
}
