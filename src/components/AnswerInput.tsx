import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AnexoFile, AnswerValueRaw, Question } from '../lib/types'
import { cn, fileSize, isAnexoList, maskCep, maskDoc, maskPhone } from '../lib/utils'
import { spring, springPop } from '../lib/anim'

export type AnswerValueT = AnswerValueRaw

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
  /** "Outros" marcado mas ainda sem texto — senão o campo fecharia sozinho */
  const [outrosOn, setOutrosOn] = useState(false)

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
    case 'doc':
    case 'cep':
    case 'phone': {
      const type =
        q.type === 'number'
          ? 'number'
          : q.type === 'date'
            ? 'date'
            : q.type === 'email'
              ? 'email'
              : 'text'
      // campo que pontua sozinho enquanto a pessoa digita
      const mascara =
        q.type === 'phone'
          ? maskPhone
          : q.type === 'doc'
            ? maskDoc
            : q.type === 'cep'
              ? maskCep
              : null
      return (
        <input
          autoFocus={autoFocus}
          type={type}
          inputMode={
            q.type === 'phone'
              ? 'tel'
              : q.type === 'number'
                ? 'decimal'
                : q.type === 'doc' || q.type === 'cep'
                  ? 'numeric'
                  : undefined
          }
          className={base}
          style={fieldStyle}
          placeholder={q.placeholder ?? placeholderFor(q.type)}
          value={value == null ? '' : String(value)}
          onKeyDown={onKey}
          onChange={(e) => onChange(mascara ? mascara(e.target.value) : e.target.value)}
          {...focusProps}
        />
      )
    }

    case 'file':
      return (
        <CampoAnexo q={q} value={value} onChange={onChange} p={p} fieldStyle={fieldStyle} />
      )

    case 'select':
      return (
        <ListaSuspensa
          q={q}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          p={p}
          base={base}
          fieldStyle={fieldStyle}
          autoFocus={autoFocus}
        />
      )

    case 'radio':
    case 'checkbox': {
      const multi = q.type === 'checkbox'
      const selected: string[] = multi
        ? Array.isArray(value)
          ? (value as unknown[]).filter((v): v is string => typeof v === 'string')
          : []
        : typeof value === 'string' && value
          ? [value]
          : []

      /*
        "Outros" não é uma opção guardada: o que fica gravado é o texto que
        a pessoa escreveu. Então o jeito de saber que ela escolheu "Outros"
        é a resposta não estar na lista de opções.
      */
      const escrito = selected.find((v) => !q.options.includes(v)) ?? ''
      const outrosAberto = !!q.allow_other && (escrito !== '' || outrosOn)

      const toggle = (opt: string) => {
        if (!multi) return onChange(opt)
        onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt])
      }

      const escrever = (texto: string) => {
        const limpo = texto.trimStart()
        if (!multi) return onChange(limpo)
        const semOutros = selected.filter((v) => q.options.includes(v))
        onChange(limpo ? [...semOutros, limpo] : semOutros)
      }

      const abrirOutros = () => {
        setOutrosOn(true)
        if (!multi && escrito === '') onChange('')
      }

      const fecharOutros = () => {
        setOutrosOn(false)
        escrever('')
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
                <Marca on={on} multi={multi} p={p} />
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

          {q.allow_other && (
            <div>
              <motion.button
                type="button"
                onClick={() => (outrosAberto ? fecharOutros() : abrirOutros())}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left text-[15px] leading-snug"
                style={{
                  borderColor: outrosAberto ? p.accent : p.line,
                  background: outrosAberto ? `${p.accent}14` : 'transparent',
                  color: p.fg,
                  borderBottomLeftRadius: outrosAberto ? 0 : undefined,
                  borderBottomRightRadius: outrosAberto ? 0 : undefined,
                }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
              >
                <Marca on={outrosAberto} multi={multi} p={p} />
                <span className="min-w-0 flex-1">Outros</span>
                <span
                  className="shrink-0 text-[12px] font-semibold opacity-50"
                  style={{ color: p.muted }}
                >
                  escrever
                </span>
              </motion.button>

              <AnimatePresence initial={false}>
                {outrosAberto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <input
                      autoFocus
                      value={escrito}
                      onChange={(e) => escrever(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          onEnter?.()
                        }
                      }}
                      placeholder="Escreva qual…"
                      className="w-full rounded-b-[12px] border border-t-0 px-3.5 py-3 text-[15px] outline-none"
                      style={{
                        borderColor: p.accent,
                        background: `${p.accent}0a`,
                        color: p.fg,
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
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
    case 'doc':
      return '000.000.000-00'
    case 'cep':
      return '00000-000'
    default:
      return 'Escreva aqui…'
  }
}

/** A bolinha (escolha única) ou o quadradinho (múltipla escolha). */
function Marca({ on, multi, p }: { on: boolean; multi: boolean; p: Palette }) {
  return (
    <span
      className={cn(
        'relative grid h-[22px] w-[22px] shrink-0 place-items-center border-2',
        multi ? 'rounded-[7px]' : 'rounded-full',
      )}
      style={{ borderColor: on ? p.accent : p.line, background: on ? p.accent : 'transparent' }}
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
  )
}

/**
 * A lista suspensa do cliente. O <select> do sistema abre uma lista
 * desenhada pelo sistema operacional: fundo branco e fonte cinza mesmo
 * num formulário escuro, sem jeito de acompanhar a cor do cliente.
 */
function ListaSuspensa({
  q,
  value,
  onChange,
  p,
  base,
  fieldStyle,
  autoFocus,
}: {
  q: Question
  value: string
  onChange: (v: AnswerValueT) => void
  p: Palette
  base: string
  fieldStyle: CSSProperties
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [escrevendo, setEscrevendo] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const escrito = value !== '' && !q.options.includes(value)
  const outrosAberto = !!q.allow_other && (escrito || escrevendo)

  useEffect(() => {
    if (!open) return
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [open])

  const rotulo = outrosAberto ? 'Outros' : value || 'Selecione…'

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        autoFocus={autoFocus}
        onClick={() => setOpen((v) => !v)}
        className={cn(base, 'flex cursor-pointer items-center gap-2 pr-10 text-left')}
        style={fieldStyle}
      >
        <span className="min-w-0 flex-1 truncate" style={{ color: value ? p.fg : p.muted }}>
          {rotulo}
        </span>
      </button>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-[22px] right-3.5 -translate-y-1/2"
        style={{ color: p.muted }}
        animate={{ rotate: open ? 180 : 0 }}
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={springPop}
            className="absolute z-40 mt-1.5 max-h-[16rem] w-full origin-top overflow-auto rounded-[13px] border p-1.5 shadow-lg"
            style={{ background: p.bg, borderColor: p.line }}
          >
            {q.options.map((o) => {
              const on = o === value
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setEscrevendo(false)
                    onChange(o)
                    setOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-[9px] px-3 py-2.5 text-left text-[15px]"
                  style={{ background: on ? `${p.accent}1f` : 'transparent', color: p.fg }}
                >
                  <span className="min-w-0 flex-1 truncate">{o}</span>
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: p.accentText }}>
                      <path
                        d="m5 12.5 4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              )
            })}

            {q.allow_other && (
              <button
                type="button"
                onClick={() => {
                  setEscrevendo(true)
                  onChange('')
                  setOpen(false)
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[9px] px-3 py-2.5 text-left text-[15px]"
                style={{
                  background: outrosAberto ? `${p.accent}1f` : 'transparent',
                  color: p.fg,
                  borderTop: `1px solid ${p.line}`,
                }}
              >
                <span className="min-w-0 flex-1 truncate">Outros</span>
                <span className="shrink-0 text-[12px]" style={{ color: p.muted }}>
                  escrever
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {outrosAberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <input
              autoFocus
              value={escrito ? value : ''}
              onChange={(e) => onChange(e.target.value.trimStart())}
              placeholder="Escreva qual…"
              className={cn(base, 'mt-2')}
              style={fieldStyle}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Teto por arquivo e por pergunta. Ver o comentário de AnexoFile. */
export const ANEXO_MAX = 3 * 1024 * 1024
export const ANEXO_MAX_TOTAL = 8 * 1024 * 1024
export const ANEXO_MAX_QTD = 5

/**
 * Anexo do cliente. O arquivo é lido no navegador e vai embutido na
 * resposta em data URL — nada é enviado para lugar nenhum antes de a
 * pessoa apertar enviar.
 */
function CampoAnexo({
  q,
  value,
  onChange,
  p,
  fieldStyle,
}: {
  q: Question
  value: AnswerValueT
  onChange: (v: AnswerValueT) => void
  p: Palette
  fieldStyle: CSSProperties
}) {
  const arquivos: AnexoFile[] = isAnexoList(value) ? value : []
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [sobre, setSobre] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const somaAtual = arquivos.reduce((t, f) => t + f.size, 0)

  async function receber(lista: FileList | null) {
    if (!lista?.length) return
    setErro(null)
    setLendo(true)
    const novos: AnexoFile[] = []
    let soma = somaAtual

    for (const file of Array.from(lista)) {
      if (arquivos.length + novos.length >= ANEXO_MAX_QTD) {
        setErro(`No máximo ${ANEXO_MAX_QTD} arquivos.`)
        break
      }
      if (file.size > ANEXO_MAX) {
        setErro(`"${file.name}" tem ${fileSize(file.size)}. O limite é ${fileSize(ANEXO_MAX)}.`)
        continue
      }
      if (soma + file.size > ANEXO_MAX_TOTAL) {
        setErro(`Somando tudo passa de ${fileSize(ANEXO_MAX_TOTAL)}.`)
        break
      }
      try {
        const data = await new Promise<string>((ok, falhou) => {
          const fr = new FileReader()
          fr.onload = () => ok(String(fr.result))
          fr.onerror = () => falhou(new Error('leitura'))
          fr.readAsDataURL(file)
        })
        novos.push({ name: file.name, size: file.size, type: file.type, data })
        soma += file.size
      } catch {
        setErro(`Não consegui ler "${file.name}".`)
      }
    }

    setLendo(false)
    if (novos.length) onChange([...arquivos, ...novos])
    if (inputRef.current) inputRef.current.value = ''
  }

  const remover = (i: number) => {
    const resto = arquivos.filter((_, j) => j !== i)
    onChange(resto.length ? resto : null)
    setErro(null)
  }

  return (
    <div>
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setSobre(true)
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSobre(false)
          void receber(e.dataTransfer.files)
        }}
        whileTap={{ scale: 0.995 }}
        transition={spring}
        className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-[13px] border border-dashed px-4 py-6 text-center"
        style={{
          ...fieldStyle,
          borderColor: sobre ? p.accent : fieldStyle.borderColor,
          background: sobre ? `${p.accent}12` : fieldStyle.background,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: p.accentText }}>
          <path
            d="M12 16.5V4.8M12 4.8 7.8 9M12 4.8 16.2 9"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 15v3.2a1.3 1.3 0 0 0 1.3 1.3h12.4a1.3 1.3 0 0 0 1.3-1.3V15"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[15px] font-semibold" style={{ color: p.fg }}>
          {lendo ? 'Lendo o arquivo…' : arquivos.length ? 'Anexar mais um' : 'Escolher arquivo'}
        </span>
        <span className="text-[12.5px]" style={{ color: p.muted }}>
          ou arraste aqui · até {fileSize(ANEXO_MAX)} cada
        </span>
      </motion.button>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void receber(e.target.files)}
      />

      <AnimatePresence initial={false}>
        {arquivos.map((f, i) => (
          <motion.div
            key={`${f.name}-${i}`}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
            transition={spring}
            className="mt-2 flex items-center gap-3 rounded-[12px] border px-3 py-2.5"
            style={{ borderColor: p.line, background: `${p.accent}0d` }}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
              style={{ background: `${p.accent}1f`, color: p.accentText }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.5 3.5h7L19 9v11.5H6.5z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
                <path d="M13 3.5V9h6" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold" style={{ color: p.fg }}>
                {f.name}
              </span>
              <span className="block text-[12px]" style={{ color: p.muted }}>
                {fileSize(f.size)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remover(i)}
              aria-label={`Remover ${f.name}`}
              className="shrink-0 cursor-pointer rounded-[8px] p-1.5"
              style={{ color: p.muted }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {erro && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-[13px] font-semibold text-[#e11d48]"
          >
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
