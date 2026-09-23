import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import { useState, type ReactElement } from 'react'
import { QUESTION_TYPES, TYPE_LABEL, type Question, type QuestionType } from '../lib/types'
import { cn } from '../lib/utils'
import { Field, Input, Picker, Switch, Textarea, type PickerItem } from './ui/Field'
import { Button, IconButton } from './ui/Button'
import { Badge } from './ui/Chrome'
import { spring, springPop } from '../lib/anim'

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const needsOptions = (t: QuestionType) => ['select', 'radio', 'checkbox'].includes(t)

/** Os tipos agrupados, para a lista não virar um paredão de 13 linhas. */
const TIPOS: PickerItem<QuestionType>[] = QUESTION_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
  hint: t.hint,
  group: ['text', 'textarea', 'number'].includes(t.value)
    ? 'Escrever'
    : ['email', 'phone', 'url', 'date', 'doc', 'cep'].includes(t.value)
      ? 'Dado com formato'
      : 'Escolher',
}))

export function blankQuestion(position: number, section: string | null = null): Question {
  return {
    id: uid(),
    position,
    section,
    type: 'text',
    label: '',
    description: null,
    placeholder: null,
    required: true,
    options: [],
  }
}

/** Ícone por tipo — ajuda a bater o olho e reconhecer. */
function TypeIcon({ type }: { type: QuestionType }) {
  const paths: Partial<Record<QuestionType, ReactElement>> = {
    text: <path d="M4 9h16M4 15h9" strokeLinecap="round" />,
    textarea: <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />,
    number: <path d="M6 8h4l-2 8M14 8h4M16 8v8M14 16h4" strokeLinecap="round" />,
    email: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
        <path d="m4.5 8 7.5 5 7.5-5" strokeLinecap="round" />
      </>
    ),
    phone: <path d="M7 4h4l1.5 4-2 1.5a10 10 0 0 0 4 4L16 11.5 20 13v4a2 2 0 0 1-2.2 2A15 15 0 0 1 5 6.2 2 2 0 0 1 7 4Z" strokeLinejoin="round" />,
    url: <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1" strokeLinecap="round" />,
    date: (
      <>
        <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3.5v4M16 3.5v4" strokeLinecap="round" />
      </>
    ),
    select: (
      <>
        <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
        <path d="m9 11 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    radio: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      </>
    ),
    checkbox: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3.5" />
        <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    yesno: <path d="M5 9.5h6M8 6.5v6M14 12.5l2.5 2.5 3.5-4" strokeLinecap="round" strokeLinejoin="round" />,
    rating: (
      <path
        d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8L12 4Z"
        strokeLinejoin="round"
      />
    ),
    scale: <path d="M3.5 12h17M7 9v6M12 8v8M17 9v6" strokeLinecap="round" />,
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      {paths[type] ?? paths.text}
    </svg>
  )
}

export default function QuestionList({
  questions,
  onChange,
}: {
  questions: Question[]
  onChange: (next: Question[]) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  const renumber = (list: Question[]) => list.map((q, i) => ({ ...q, position: i + 1 }))

  const patch = (id: string, p: Partial<Question>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...p } : q)))

  const remove = (id: string) => onChange(renumber(questions.filter((q) => q.id !== id)))

  const duplicate = (id: string) => {
    const i = questions.findIndex((q) => q.id === id)
    if (i < 0) return
    const copy: Question = { ...questions[i], id: uid(), label: `${questions[i].label} (cópia)` }
    const next = [...questions]
    next.splice(i + 1, 0, copy)
    onChange(renumber(next))
  }

  const add = () => {
    const last = questions[questions.length - 1]
    const q = blankQuestion(questions.length + 1, last?.section ?? null)
    onChange([...questions, q])
    setOpenId(q.id)
    requestAnimationFrame(() =>
      document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  return (
    <div>
      <Reorder.Group
        axis="y"
        values={questions}
        onReorder={(next) => onChange(renumber(next as Question[]))}
        className="space-y-2.5"
      >
        <AnimatePresence initial={false}>
          {questions.map((q, i) => (
            <Row
              key={q.id}
              q={q}
              index={i}
              open={openId === q.id}
              showSection={q.section !== (questions[i - 1]?.section ?? null)}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
              onPatch={(p) => patch(q.id, p)}
              onRemove={() => remove(q.id)}
              onDuplicate={() => duplicate(q.id)}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      <motion.button
        type="button"
        onClick={add}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={spring}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-line bg-surface/60 py-3.5 text-[14px] font-semibold text-ink-3 transition-colors hover:border-brand hover:bg-brand-soft/50 hover:text-brand"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
        Adicionar pergunta
      </motion.button>

      <p className="mt-2.5 text-center text-[12.5px] text-ink-4">
        Arraste pelo ⠿ para reordenar · clique na pergunta para editar
      </p>
    </div>
  )
}

function Row({
  q,
  index,
  open,
  showSection,
  onToggle,
  onPatch,
  onRemove,
  onDuplicate,
}: {
  q: Question
  index: number
  open: boolean
  showSection: boolean
  onToggle: () => void
  onPatch: (p: Partial<Question>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      id={`q-${q.id}`}
      value={q}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      whileDrag={{ scale: 1.015, zIndex: 40, cursor: 'grabbing' }}
      transition={spring}
      className="list-none"
    >
      {showSection && q.section && (
        <div className="mt-5 mb-2 flex items-center gap-2.5">
          <span className="text-[12px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">
            {q.section}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}

      <div
        className={cn(
          'group relative overflow-hidden rounded-[16px] border bg-surface transition-shadow',
          open ? 'border-brand-line shadow-md' : 'border-line shadow-xs hover:shadow-sm',
        )}
      >
        {/* barra lateral quando aberta */}
        <AnimatePresence>
          {open && (
            <motion.span
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
              transition={spring}
              className="absolute inset-y-0 left-0 w-[5px] origin-center bg-brand"
            />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2.5 py-2.5 pr-2.5 pl-3">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Arrastar"
            className="cursor-grab touch-none px-0.5 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink-2 active:cursor-grabbing"
          >
            <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
              {[0, 1, 2].map((r) =>
                [0, 1].map((c) => (
                  <circle key={`${r}-${c}`} cx={4 + c * 6} cy={3 + r * 5} r="1.5" />
                )),
              )}
            </svg>
          </button>

          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-canvas-2 text-[12px] font-bold text-ink-3 tabular-nums">
            {index + 1}
          </span>

          <button type="button" onClick={onToggle} className="min-w-0 flex-1 cursor-pointer py-1 text-left">
            <p
              className={cn(
                'truncate text-[15px] font-medium',
                q.label ? 'text-ink' : 'text-ink-4 italic',
              )}
            >
              {q.label || 'pergunta sem texto'}
              {q.required && <span className="ml-1 text-danger">*</span>}
            </p>
          </button>

          <span className="hidden items-center gap-1.5 rounded-full bg-canvas-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2 sm:inline-flex">
            <TypeIcon type={q.type} />
            {TYPE_LABEL[q.type]}
          </span>

          <div className="flex shrink-0 items-center">
            <IconButton label="Duplicar" size="sm" onClick={onDuplicate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
                <path
                  d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
            <IconButton label="Remover" size="sm" tone="danger" onClick={onRemove}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.7 11.1A2 2 0 0 0 9.2 20h5.6a2 2 0 0 0 2-1.9L17.5 7"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
            <IconButton label={open ? 'Fechar' : 'Editar'} size="sm" onClick={onToggle}>
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={springPop}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m6 9.5 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.span>
            </IconButton>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="grid gap-4 border-t border-line-2 bg-surface-2/70 px-4 py-4 sm:grid-cols-2">
                <Field label="Pergunta" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={q.label}
                    placeholder="O que você quer perguntar?"
                    onChange={(e) => onPatch({ label: e.target.value })}
                  />
                </Field>

                <Field label="Tipo de resposta">
                  <Picker
                    id={`tipo-${q.id}`}
                    value={q.type}
                    items={TIPOS}
                    onChange={(type) =>
                      onPatch({
                        type,
                        options:
                          needsOptions(type) && q.options.length === 0
                            ? ['Opção 1', 'Opção 2']
                            : q.options,
                      })
                    }
                  />
                </Field>

                <Field label="Seção" hint="Agrupa perguntas na tela do cliente.">
                  <Input
                    value={q.section ?? ''}
                    placeholder="ex.: Sobre a empresa"
                    onChange={(e) => onPatch({ section: e.target.value || null })}
                  />
                </Field>

                <Field label="Texto de ajuda" className="sm:col-span-2">
                  <Input
                    value={q.description ?? ''}
                    placeholder="Instrução curta que aparece abaixo da pergunta"
                    onChange={(e) => onPatch({ description: e.target.value || null })}
                  />
                </Field>

                <AnimatePresence initial={false}>
                  {needsOptions(q.type) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden sm:col-span-2"
                    >
                      <OptionEditor
                        options={q.options}
                        allowOther={q.allow_other ?? false}
                        onAllowOther={(allow_other) => onPatch({ allow_other })}
                        onChange={(options) => onPatch({ options })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between gap-4 border-t border-line-2 pt-3.5 sm:col-span-2">
                  <Switch
                    checked={q.required}
                    onChange={(v) => onPatch({ required: v })}
                    label="Resposta obrigatória"
                    hint="O cliente não avança sem preencher."
                  />
                  <Badge tone="brand">
                    <TypeIcon type={q.type} />
                    {TYPE_LABEL[q.type]}
                  </Badge>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

/* ── Editor de opções, uma linha por opção ──────────────── */

function OptionEditor({
  options,
  onChange,
  allowOther,
  onAllowOther,
}: {
  options: string[]
  onChange: (v: string[]) => void
  allowOther: boolean
  onAllowOther: (v: boolean) => void
}) {
  const set = (i: number, v: string) => onChange(options.map((o, j) => (j === i ? v : o)))
  const add = () => onChange([...options, `Opção ${options.length + 1}`])
  const del = (i: number) => onChange(options.filter((_, j) => j !== i))

  return (
    <Field label="Opções">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {options.map((o, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
              transition={spring}
              className="flex items-center gap-2"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-[11px] font-bold text-ink-3">
                {String.fromCharCode(65 + i)}
              </span>
              <Input
                value={o}
                onChange={(e) => set(i, e.target.value)}
                className="h-10 flex-1"
                placeholder={`Opção ${i + 1}`}
              />
              <IconButton
                label="Remover opção"
                size="sm"
                tone="danger"
                onClick={() => del(i)}
                disabled={options.length <= 1}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </IconButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={add}>
        + Adicionar opção
      </Button>

      <div className="mt-3 border-t border-line-2 pt-3">
        <Switch
          checked={allowOther}
          onChange={onAllowOther}
          label="Deixar o cliente escrever uma opção"
          hint={
            allowOther
              ? 'Aparece "Outros" no fim da lista, com um campo para ele escrever qual. O que fica gravado é o texto dele.'
              : 'Quem não se encaixa em nenhuma opção fica sem saída.'
          }
        />
      </div>
    </Field>
  )
}
