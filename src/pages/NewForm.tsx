import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import gsap from 'gsap'
import {
  ACCEPTED_FILES,
  downloadTemplate,
  parseAnyFile,
  parseTextToQuestions,
  type ParseReport,
} from '../lib/sheet'
import { TEMPLATES, templateQuestions, type Template } from '../lib/templates'
import { createForm, slugTaken } from '../lib/db'
import { DEFAULT_THEME, TYPE_LABEL, type DraftForm, type Question } from '../lib/types'
import {
  accentOnSurface,
  cn,
  copy,
  isReservedSlug,
  publicUrl,
  randomPassword,
  readableOn,
  slugify,
} from '../lib/utils'
import { detectLogoBg, fileToLogo, getDefaultLogo, setDefaultLogo } from '../lib/brand'
import { Button, IconButton } from '../components/ui/Button'
import { Field, Input, Segmented, Select, Switch, Textarea } from '../components/ui/Field'
import { Badge, CheckBurst, SectionTitle } from '../components/ui/Chrome'
import { useToast } from '../components/ui/Feedback'
import QuestionList, { blankQuestion } from '../components/QuestionList'
import ShareBlock, { shareText } from '../components/ShareBlock'
import { pageVariants, spring, springPop, stepVariants } from '../lib/anim'

const STEPS = ['Importar', 'Perguntas', 'Configurar', 'Pronto'] as const

export const ACCENTS = [
  { hex: '#5646f5', name: 'índigo' },
  { hex: '#7c3aed', name: 'violeta' },
  { hex: '#2563eb', name: 'azul' },
  { hex: '#0891b2', name: 'ciano' },
  { hex: '#0d9f6e', name: 'verde' },
  { hex: '#d97706', name: 'âmbar' },
  { hex: '#e11d48', name: 'rosa' },
  { hex: '#334155', name: 'grafite' },
]

export default function NewForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  const [report, setReport] = useState<ParseReport | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [draft, setDraft] = useState<Omit<DraftForm, 'questions'>>({
    title: '',
    client_name: '',
    description: '',
    slug: '',
    password: '',
    intro: '',
    outro: '',
    status: 'published',
    allow_edit: true,
    theme: (() => {
      const padrao = getDefaultLogo()
      return { ...DEFAULT_THEME, logo: padrao?.url ?? null, logoBg: padrao?.bg ?? null }
    })(),
  })
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugState, setSlugState] = useState<SlugState>('empty')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ slug: string; id: string } | null>(null)

  const go = (to: number) => {
    setDir(to > step ? 1 : -1)
    setStep(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* O endereço nasce do cliente + título. Se já existir um igual, entra
     um sufixo numérico — o usuário não precisa pensar nisso. */
  useEffect(() => {
    if (slugEdited) return
    const base = slugify([draft.client_name, draft.title].filter(Boolean).join(' '))
    if (!base) {
      setDraft((d) => (d.slug ? { ...d, slug: '' } : d))
      return
    }
    let alive = true
    const timer = window.setTimeout(async () => {
      let candidate = base
      for (let i = 2; i <= 30; i++) {
        if (!(await slugTaken(candidate))) break
        candidate = `${base}-${i}`
      }
      if (alive) setDraft((d) => (d.slug === candidate ? d : { ...d, slug: candidate }))
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [draft.title, draft.client_name, slugEdited])

  const canAdvance = useMemo(() => {
    if (step === 0) return questions.length > 0
    if (step === 1) return questions.length > 0 && questions.every((q) => q.label.trim())
    if (step === 2) return !!draft.title.trim() && slugState === 'free'
    return true
  }, [step, questions, draft, slugState])

  async function save() {
    setSaving(true)
    try {
      const form = await createForm({
        ...draft,
        slug: slugify(draft.slug),
        questions: questions.map((q, i) => ({ ...q, position: i + 1 })),
      })
      setCreated({ slug: form.slug, id: form.id })
      setDir(1)
      setStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.8rem,4vw,2.2rem)] font-extrabold tracking-[-0.035em]">
            Criar formulário
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-3">
            De uma planilha, um documento ou um texto colado até o link do cliente.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/painel')}>
          ← Voltar
        </Button>
      </div>

      <Stepper
        step={step}
        locked={!!created}
        onGo={(i) => (i < step || canAdvance) && !created && go(i)}
      />

      <div className="relative mt-8 min-h-[24rem]">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === 0 && (
              <StepUpload
                report={report}
                onParsed={(r) => {
                  setReport(r)
                  setQuestions(r.questions)
                }}
                onScratch={() => {
                  setReport(null)
                  setQuestions([blankQuestion(1)])
                  go(1)
                }}
                onNext={() => go(1)}
              />
            )}

            {step === 1 && (
              <StepQuestions questions={questions} onChange={setQuestions} report={report} />
            )}

            {step === 2 && (
              <StepConfigure
                draft={draft}
                setDraft={setDraft}
                slugError={slugError}
                slugAuto={!slugEdited}
                onSlugChange={(v) => {
                  setSlugEdited(true)
                  setSlugError(null)
                  setDraft((d) => ({ ...d, slug: v }))
                }}
                onSlugAuto={() => setSlugEdited(false)}
                onSlugState={setSlugState}
                questionCount={questions.length}
              />
            )}

            {step === 3 && created && (
              <StepDone
                slug={created.slug}
                password={draft.password}
                title={draft.title}
                accent={draft.theme.accent}
                onOpenPanel={() => navigate(`/painel/f/${created.id}`)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!created && (
        <div className="sticky bottom-0 z-30 mt-10">
          {/* faixa de ponta a ponta: presa à largura do conteúdo ela fica
              flutuando no meio da tela, com dois cantos soltos */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-[100vw] -translate-x-1/2 border-t border-line bg-surface/90 backdrop-blur-xl"
          />
          <div className="relative flex items-center justify-between gap-4 py-3.5">
          <Button variant="ghost" onClick={() => (step === 0 ? navigate('/painel') : go(step - 1))}>
            {step === 0 ? 'Cancelar' : '← Voltar'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-3 sm:block">
              {questions.length > 0
                ? `${questions.length} pergunta${questions.length > 1 ? 's' : ''}`
                : 'nenhuma pergunta ainda'}
            </span>
            {step < 2 ? (
              <Button disabled={!canAdvance} onClick={() => go(step + 1)}>
                Continuar →
              </Button>
            ) : (
              <Button disabled={!canAdvance} loading={saving} onClick={save}>
                Criar e gerar link
              </Button>
            )}
          </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

/* ══════════════ indicador de etapas ══════════════ */

function Stepper({
  step,
  onGo,
  locked,
}: {
  step: number
  onGo: (i: number) => void
  locked: boolean
}) {
  return (
    <ol className="mt-6 flex items-center gap-1 sm:gap-2">
      {STEPS.map((label, i) => {
        const done = i < step
        const now = i === step
        return (
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => onGo(i)}
              className={cn(
                'flex min-w-0 shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-3 pl-1.5 transition-colors',
                !locked && !now && 'cursor-pointer hover:bg-canvas-2',
                now && 'bg-brand-soft',
              )}
            >
              <motion.span
                animate={
                  now
                    ? { backgroundColor: '#5646f5', color: '#ffffff' }
                    : done
                      ? { backgroundColor: '#0d9f6e', color: '#ffffff' }
                      : { backgroundColor: '#e9ecf5', color: '#868da1' }
                }
                transition={spring}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold"
              >
                {done ? (
                  <motion.svg
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={spring}
                    width="15"
                    height="15"
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
                  i + 1
                )}
              </motion.span>
              <span
                className={cn(
                  'hidden text-[13.5px] font-semibold whitespace-nowrap sm:block',
                  now ? 'text-brand' : done ? 'text-ink-2' : 'text-ink-4',
                )}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-canvas-2">
                <motion.span
                  className="block h-full rounded-full bg-ok"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ══════════════ 01 · de onde vêm as perguntas ══════════════ */

type Mode = 'arquivo' | 'texto' | 'modelo'

const MODES: { id: Mode; title: string; blurb: string; icon: ReactElement }[] = [
  {
    id: 'arquivo',
    title: 'Enviar arquivo',
    blurb: 'Planilha ou documento do Word',
    icon: (
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'texto',
    title: 'Colar texto',
    blurb: 'Uma pergunta por linha',
    icon: (
      <path
        d="M5 6h14M5 11h14M5 16h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'modelo',
    title: 'Modelo pronto',
    blurb: 'Começa com perguntas já feitas',
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
]

const FORMATS = ['.xlsx', '.csv', '.docx', '.txt', '.md', '.rtf']

const FLOWS: { value: 'cards' | 'steps' | 'single'; label: string; blurb: string; tip?: string }[] = [
  {
    value: 'single',
    label: 'Tudo aberto na página',
    tip: 'padrão',
    blurb: 'Todos os campos visíveis de uma vez, um embaixo do outro. O cliente rola e preenche.',
  },
  {
    value: 'cards',
    label: 'Lista com toque',
    blurb: 'Todas as perguntas numa tela só. O cliente toca numa e responde numa janelinha.',
  },
  {
    value: 'steps',
    label: 'Uma pergunta por tela',
    blurb: 'Avança de uma em uma. Bom para formulário longo e focado.',
  },
]

const PASTE_EXAMPLE = `Sobre a empresa:
Qual o nome da empresa?
Descreva o negócio em poucas linhas (texto longo)
Quantos funcionários hoje? (número)

Projeto:
Qual o objetivo principal?
- Vender mais
- Reduzir custo
- Lançar produto

E-mail do responsável
Telefone (opcional)`

function StepUpload({
  report,
  onParsed,
  onScratch,
  onNext,
}: {
  report: ParseReport | null
  onParsed: (r: ParseReport) => void
  onScratch: () => void
  onNext: () => void
}) {
  const [mode, setMode] = useState<Mode>('arquivo')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (f: File, sheetIndex?: number) => {
      setBusy(true)
      setError(null)
      setFileName(f.name)
      setFile(f)
      try {
        onParsed(await parseAnyFile(f, sheetIndex))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não consegui ler esse arquivo.')
      } finally {
        setBusy(false)
      }
    },
    [onParsed],
  )

  /* Texto colado: relê sozinho um instante depois de parar de digitar. */
  useEffect(() => {
    if (mode !== 'texto') return
    const raw = pasted.trim()
    if (!raw) {
      setError(null)
      return
    }
    const t = window.setTimeout(() => {
      try {
        setError(null)
        setFileName('texto colado')
        onParsed(parseTextToQuestions(pasted))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não consegui entender esse texto.')
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [pasted, mode, onParsed])

  function useTemplate(t: Template) {
    setError(null)
    setFileName(t.name)
    onParsed({
      questions: templateQuestions(t),
      kind: 'text',
      sheetName: t.name,
      sheets: [],
      totalRows: t.rows.length,
      skipped: 0,
      headerFound: false,
      mapped: {},
      warnings: [],
    })
    window.setTimeout(onNext, 420)
  }

  return (
    <div>
      {/* ── como começar ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => {
          const active = mode === m.id
          return (
            <motion.button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id)
                setError(null)
              }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
              transition={spring}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 rounded-[16px] border p-4 text-left transition-colors',
                active
                  ? 'border-brand bg-brand-soft/60 shadow-sm'
                  : 'border-line bg-surface hover:border-ink-4',
              )}
            >
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-[13px] transition-colors',
                  active ? 'bg-brand text-white' : 'bg-canvas-2 text-ink-3',
                )}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  {m.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[15px] font-bold', active ? 'text-brand' : 'text-ink')}>
                  {m.title}
                </span>
                <span className="block text-[12.5px] text-ink-3">{m.blurb}</span>
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {mode === 'arquivo' && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOver(true)
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setOver(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) void handleFile(f)
                  }}
                  className={cn(
                    'relative overflow-hidden rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors duration-200',
                    over ? 'border-brand bg-brand-soft/60' : 'border-line bg-surface',
                  )}
                >
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
                    animate={{ scale: over ? 1.4 : 1, opacity: over ? 1 : 0.5 }}
                    transition={{ duration: 0.5 }}
                  />

                  <motion.div
                    animate={{ y: over ? -8 : 0, scale: over ? 1.02 : 1 }}
                    transition={spring}
                    className="relative z-10"
                  >
                    <div className="mx-auto flex items-end justify-center gap-2">
                      <PaperIcon tint="#0d9f6e" label="xlsx" delay={0} />
                      <PaperIcon tint="#5646f5" label="docx" delay={0.12} big />
                      <PaperIcon tint="#868da1" label="txt" delay={0.24} />
                    </div>

                    <p className="mt-6 text-[21px] font-extrabold tracking-[-0.025em]">
                      {busy
                        ? 'Lendo o arquivo…'
                        : over
                          ? 'Pode soltar!'
                          : 'Arraste a planilha ou o documento'}
                    </p>
                    <p className="mt-1.5 text-[14px] text-ink-3">
                      Uma pergunta por linha — o sistema entende o resto.
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {FORMATS.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-canvas-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-3"
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                      <Button type="button" onClick={() => inputRef.current?.click()} loading={busy}>
                        Escolher arquivo
                      </Button>
                      <Button type="button" variant="outline" onClick={onScratch}>
                        Começar do zero
                      </Button>
                    </div>
                  </motion.div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_FILES}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleFile(f)
                      e.target.value = ''
                    }}
                  />
                </div>
              )}

              {mode === 'texto' && (
                <div className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-4 py-3">
                    <span className="text-[13.5px] font-semibold text-ink-2">
                      Cole a lista de perguntas
                    </span>
                    <button
                      type="button"
                      onClick={() => setPasted(PASTE_EXAMPLE)}
                      className="cursor-pointer text-[12.5px] font-semibold text-brand hover:underline"
                    >
                      Ver exemplo
                    </button>
                  </div>
                  <textarea
                    autoFocus
                    rows={14}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={PASTE_EXAMPLE}
                    className="w-full resize-y border-0 px-4 py-3.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-ink-4"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 bg-surface-2 px-4 py-3">
                    <span className="text-[12.5px] text-ink-3">
                      {pasted.trim()
                        ? `${pasted.trim().split(/\r?\n/).filter((l) => l.trim()).length} linhas`
                        : 'Cole ou digite — eu leio enquanto você escreve.'}
                    </span>
                    {pasted.trim() && (
                      <Button size="sm" variant="ghost" onClick={() => setPasted('')}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {mode === 'modelo' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {TEMPLATES.map((t, i) => (
                    <motion.button
                      key={t.id}
                      type="button"
                      onClick={() => useTemplate(t)}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.985 }}
                      className="group cursor-pointer overflow-hidden rounded-[16px] border border-line bg-surface text-left shadow-xs transition-shadow hover:shadow-md"
                    >
                      <div className="h-1.5 w-full" style={{ background: t.accent }} />
                      <div className="p-4">
                        <p className="text-[15.5px] font-bold text-ink transition-colors group-hover:text-brand">
                          {t.name}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{t.blurb}</p>
                        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: t.accent }}>
                          {t.rows.length} perguntas
                          <span className="transition-transform group-hover:translate-x-1">→</span>
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-[12px] bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {report && !error && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring}
                className="card mt-5 overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
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
                    <span className="min-w-0">
                      <p className="truncate text-[14px] font-bold">{fileName ?? report.sheetName}</p>
                      <p className="text-[12.5px] text-ink-3">
                        {report.kind === 'sheet'
                          ? 'planilha lida com sucesso'
                          : report.kind === 'doc'
                            ? 'documento lido com sucesso'
                            : 'texto interpretado'}
                      </p>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.sheets.length > 1 && (
                      <select
                        className="h-9 cursor-pointer rounded-[10px] border border-line bg-surface px-2.5 text-[13px]"
                        value={report.sheetName}
                        onChange={(e) => {
                          const idx = report.sheets.indexOf(e.target.value)
                          if (file) void handleFile(file, idx)
                        }}
                      >
                        {report.sheets.map((sh) => (
                          <option key={sh} value={sh}>
                            aba: {sh}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button size="sm" onClick={onNext}>
                      Revisar {report.questions.length} perguntas →
                    </Button>
                  </div>
                </div>

                <ul className="max-h-52 divide-y divide-line-2 overflow-auto">
                  {report.questions.slice(0, 8).map((q, i) => (
                    <li key={q.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-5 shrink-0 text-[12px] font-bold text-ink-4 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
                        {q.label}
                      </span>
                      <Badge>{TYPE_LABEL[q.type]}</Badge>
                    </li>
                  ))}
                  {report.questions.length > 8 && (
                    <li className="px-4 py-2.5 text-[12.5px] text-ink-3">
                      + {report.questions.length - 8} perguntas
                    </li>
                  )}
                </ul>

                {report.warnings.length > 0 && (
                  <ul className="space-y-1 border-t border-line-2 bg-warn-soft px-4 py-3">
                    {report.warnings.map((w, i) => (
                      <li key={i} className="text-[12.5px] text-warn">
                        ⚠ {w}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── ajuda muda conforme o modo ── */}
        <aside className="card self-start overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {mode === 'arquivo' && (
                <>
                  <div className="border-b border-line-2 p-5">
                    <p className="text-[16px] font-bold tracking-[-0.02em]">O que eu aceito</p>
                    <ul className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-ink-3">
                      <li>
                        <b className="text-ink-2">Planilha</b> — uma pergunta por linha, colunas
                        Seção / Pergunta / Tipo / Opções.
                      </li>
                      <li>
                        <b className="text-ink-2">Word (.docx)</b> — leio os parágrafos. Se as
                        perguntas estiverem numa tabela, leio a tabela.
                      </li>
                      <li>
                        <b className="text-ink-2">Texto (.txt, .md)</b> — uma pergunta por linha,
                        alternativas com “-” logo abaixo.
                      </li>
                    </ul>
                    <Button
                      variant="soft"
                      size="sm"
                      className="mt-4"
                      onClick={() => void downloadTemplate()}
                    >
                      ⤓ Baixar modelo .xlsx
                    </Button>
                  </div>
                  <p className="bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">
                    Deixe a coluna <b className="text-ink-2">Tipo</b> vazia que o sistema adivinha
                    pelo texto da pergunta. Separe opções com <b className="text-ink-2">|</b>.
                  </p>
                </>
              )}

              {mode === 'texto' && (
                <div className="p-5">
                  <p className="text-[16px] font-bold tracking-[-0.02em]">Como escrever</p>
                  <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed text-ink-3">
                    <li>Uma pergunta por linha.</li>
                    <li>
                      Linha terminada em <b className="text-ink-2">:</b> vira o nome de uma seção.
                    </li>
                    <li>
                      Alternativas começam com <b className="text-ink-2">-</b> logo abaixo da
                      pergunta.
                    </li>
                    <li>
                      <b className="text-ink-2">(texto longo)</b>, <b className="text-ink-2">(data)</b>,{' '}
                      <b className="text-ink-2">(número)</b> no fim forçam o tipo.
                    </li>
                    <li>
                      <b className="text-ink-2">(opcional)</b> tira a obrigatoriedade.
                    </li>
                  </ul>
                </div>
              )}

              {mode === 'modelo' && (
                <div className="p-5">
                  <p className="text-[16px] font-bold tracking-[-0.02em]">Modelos prontos</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
                    São pontos de partida. Ao escolher um, você cai direto na revisão e pode
                    trocar, apagar ou acrescentar o que quiser antes de publicar.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={onScratch}>
                    Prefiro começar do zero
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
  )
}

/** Papelzinho colorido usado na ilustração do dropzone. */
function PaperIcon({
  tint,
  label,
  delay,
  big,
}: {
  tint: string
  label: string
  delay: number
  big?: boolean
}) {
  return (
    <motion.span
      className="relative grid place-items-end overflow-hidden rounded-[9px] border border-line bg-surface shadow-sm"
      style={{ width: big ? 46 : 38, height: big ? 58 : 48 }}
      animate={{ y: [0, -6, 0], rotate: big ? 0 : label === 'xlsx' ? -6 : 6 }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <span className="absolute inset-x-2 top-2.5 space-y-1">
        {[100, 70, 85].map((w, i) => (
          <span
            key={i}
            className="block h-[3px] rounded-full bg-canvas-2"
            style={{ width: `${w}%` }}
          />
        ))}
      </span>
      <span
        className="w-full py-[3px] text-center text-[8.5px] font-bold text-white"
        style={{ background: tint }}
      >
        {label}
      </span>
    </motion.span>
  )
}

/* ══════════════ 02 · perguntas ══════════════ */

function StepQuestions({
  questions,
  onChange,
  report,
}: {
  questions: Question[]
  onChange: (q: Question[]) => void
  report: ParseReport | null
}) {
  const missing = questions.filter((q) => !q.label.trim()).length
  /** quantos campos o sistema deduziu como algo diferente de texto livre */
  const naoTexto = questions.filter((q) => q.type !== 'text').length
  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle
        title="Revise as perguntas"
        subtitle={
          report
            ? 'Li a planilha e deduzi o tipo de cada resposta. Confira o que ficou estranho e siga.'
            : 'Monte as perguntas na mão. Dá para arrastar e reordenar a qualquer momento.'
        }
        right={
          <div className="flex items-center gap-2">
            {naoTexto > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange(questions.map((q) => ({ ...q, type: 'text' as const })))
                }
                title="Todo campo vira caixa de texto livre"
              >
                Tudo como texto
              </Button>
            )}
            <Badge tone={missing > 0 ? 'warn' : 'neutral'}>
              {questions.length} itens{missing > 0 && ` · ${missing} sem texto`}
            </Badge>
          </div>
        }
      />
      <div className="mt-5">
        <QuestionList questions={questions} onChange={onChange} />
      </div>
    </div>
  )
}

/* ══════════════ 03 · configurar ══════════════ */

export type SlugState = 'empty' | 'checking' | 'free' | 'taken'

const STATUS_CARDS: {
  value: DraftForm['status']
  label: string
  blurb: string
  tone: string
  dot: string
}[] = [
  {
    value: 'published',
    label: 'No ar',
    blurb: 'O cliente já consegue responder.',
    tone: 'border-ok bg-ok-soft',
    dot: 'bg-ok',
  },
  {
    value: 'draft',
    label: 'Rascunho',
    blurb: 'O link fica bloqueado.',
    tone: 'border-ink-4 bg-canvas-2',
    dot: 'bg-ink-3',
  },
  {
    value: 'closed',
    label: 'Encerrado',
    blurb: 'Não recebe mais respostas.',
    tone: 'border-warn bg-warn-soft',
    dot: 'bg-warn',
  },
]

export function StepConfigure({
  draft,
  setDraft,
  slugError,
  slugAuto = true,
  onSlugChange,
  onSlugAuto,
  onSlugState,
  ignoreId,
  questionCount,
}: {
  draft: Omit<DraftForm, 'questions'>
  setDraft: (fn: (d: Omit<DraftForm, 'questions'>) => Omit<DraftForm, 'questions'>) => void
  slugError: string | null
  /** o endereço ainda está sendo gerado sozinho */
  slugAuto?: boolean
  onSlugChange: (v: string) => void
  onSlugAuto?: () => void
  onSlugState?: (s: SlugState) => void
  /** id do próprio formulário, para não acusar conflito consigo mesmo */
  ignoreId?: string
  questionCount: number
}) {
  const toast = useToast()
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugState, setSlugState] = useState<SlugState>('checking')
  const report = useRef(onSlugState)
  report.current = onSlugState

  const set = <K extends keyof Omit<DraftForm, 'questions'>>(
    k: K,
    v: Omit<DraftForm, 'questions'>[K],
  ) => setDraft((d) => ({ ...d, [k]: v }))

  /* Confere disponibilidade sempre que o endereço muda. */
  useEffect(() => {
    const clean = slugify(draft.slug)
    if (!clean) {
      setSlugState('empty')
      report.current?.('empty')
      return
    }
    // o endereço do cliente agora mora na raiz, então um apelido igual a
    // 'painel' ou 'entrar' abriria o painel em vez do formulário
    if (isReservedSlug(clean)) {
      setSlugState('taken')
      report.current?.('taken')
      return
    }
    setSlugState('checking')
    report.current?.('checking')
    let alive = true
    const timer = window.setTimeout(async () => {
      const taken = await slugTaken(clean, ignoreId)
      if (!alive) return
      const next: SlugState = taken ? 'taken' : 'free'
      setSlugState(next)
      report.current?.(next)
    }, 320)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [draft.slug, ignoreId])

  const url = `${window.location.origin}/${slugify(draft.slug) || 'endereco'}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
      <div className="min-w-0 space-y-4">
        {/* ── identificação ── */}
        <section className="card p-5">
          <SectionTitle
            title="Identificação"
            subtitle="A logo e o título são a primeira coisa que o cliente vê."
          />
          <div className="mt-5 grid items-start gap-5 sm:grid-cols-[15rem_1fr]">
            <LogoPicker
              value={draft.theme.logo}
              bg={draft.theme.logoBg ?? null}
              onChange={(logo, logoBg) => set('theme', { ...draft.theme, logo, logoBg })}
            />
            <div className="grid gap-4">
              <Field label="Título do formulário" required>
                <Input
                  value={draft.title}
                  placeholder="Briefing de Identidade Visual"
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cliente">
                  <Input
                    value={draft.client_name}
                    placeholder="Brisa Café"
                    onChange={(e) => set('client_name', e.target.value)}
                  />
                </Field>
                <Field label="Descrição interna" hint="Só a equipe vê.">
                  <Input
                    value={draft.description}
                    placeholder="Levantamento para a nova marca"
                    onChange={(e) => set('description', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </section>

        {/* ── link ── */}
        <section className="card p-5">
          <SectionTitle
            title="Link do cliente"
            subtitle="Gerado sozinho a partir do cliente e do título."
            right={
              !editingSlug && (
                <button
                  type="button"
                  onClick={() => setEditingSlug(true)}
                  className="cursor-pointer text-[12.5px] font-semibold text-brand hover:underline"
                >
                  Editar endereço
                </button>
              )
            }
          />

          <AnimatePresence mode="wait" initial={false}>
            {!editingSlug ? (
              <motion.div
                key="view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mt-4 flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-3.5 py-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-brand-soft text-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink-2">
                    {window.location.origin}/
                    <b className="font-bold text-ink">{slugify(draft.slug) || '…'}</b>
                  </span>
                  <SlugHint state={slugState} auto={slugAuto} error={slugError} />
                </span>
                <IconButton
                  label="Copiar link"
                  size="sm"
                  disabled={slugState !== 'free'}
                  onClick={async () => {
                    const ok = await copy(url)
                    toast(ok ? 'Link copiado.' : 'Não consegui copiar.', ok ? 'ok' : 'error')
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="9"
                      width="11"
                      height="11"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                    />
                    <path
                      d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              </motion.div>
            ) : (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mt-4"
              >
                <Input
                  autoFocus
                  value={draft.slug}
                  prefix={<span className="font-medium text-ink-3">/</span>}
                  placeholder="brisa-cafe-briefing"
                  onChange={(e) => onSlugChange(e.target.value)}
                  invalid={slugState === 'taken' || !!slugError}
                  suffix={<SlugMark state={slugState} />}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <SlugHint state={slugState} auto={false} error={slugError} />
                  <div className="flex gap-1">
                    {onSlugAuto && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onSlugAuto()
                          setEditingSlug(false)
                        }}
                      >
                        Voltar ao automático
                      </Button>
                    )}
                    <Button size="sm" variant="soft" onClick={() => setEditingSlug(false)}>
                      Concluir
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── acesso ── */}
        <section className="card p-5">
          <SectionTitle title="Acesso" subtitle="Quem pode abrir e quando." />

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {STATUS_CARDS.map((o) => {
              const on = draft.status === o.value
              return (
                <motion.button
                  key={o.value}
                  type="button"
                  onClick={() => set('status', o.value)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={spring}
                  className={cn(
                    'cursor-pointer rounded-[14px] border p-3.5 text-left transition-colors',
                    on ? o.tone : 'border-line bg-surface hover:border-ink-4',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2',
                        on ? 'border-transparent' : 'border-line',
                      )}
                    >
                      {on && <span className={cn('h-4 w-4 rounded-full', o.dot)} />}
                    </span>
                    <span className="text-[14px] font-bold text-ink">{o.label}</span>
                  </span>
                  <span className="mt-1 block pl-6 text-[12.5px] leading-snug text-ink-3">
                    {o.blurb}
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="mt-5 space-y-4 border-t border-line-2 pt-4">
            <Switch
              checked={draft.allow_edit}
              onChange={(v) => set('allow_edit', v)}
              label="Cliente pode corrigir depois de enviar"
              hint={
                draft.allow_edit
                  ? 'Ele reabre o mesmo link, vê o que respondeu e ajusta. Fica uma resposta só, como um documento.'
                  : 'Cada envio vira uma resposta nova e não dá para voltar atrás.'
              }
            />

            <Switch
              checked={!!draft.password}
              onChange={(v) => set('password', v ? randomPassword() : '')}
              label="Proteger com senha"
              hint={
                draft.allow_edit
                  ? 'A senha é a chave que o cliente usa para reabrir e corrigir.'
                  : 'Sem senha, qualquer um com o link responde.'
              }
            />

            <AnimatePresence initial={false}>
              {!!draft.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      value={draft.password}
                      onChange={(e) => set('password', e.target.value)}
                      className="flex-1"
                      suffix={
                        <span className="text-[11.5px] font-semibold text-ink-4">
                          {draft.password.length} car.
                        </span>
                      }
                    />
                    <IconButton
                      label="Gerar outra senha"
                      onClick={() => set('password', randomPassword())}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 11a8 8 0 1 0-.6 3M20 5v6h-6"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </IconButton>
                    <IconButton
                      label="Copiar senha"
                      onClick={async () => {
                        const ok = await copy(draft.password)
                        toast(ok ? 'Senha copiada.' : 'Não consegui copiar.', ok ? 'ok' : 'error')
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <rect
                          x="9"
                          y="9"
                          width="11"
                          height="11"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="1.9"
                        />
                        <path
                          d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      </svg>
                    </IconButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {draft.allow_edit && !draft.password && (
              <p className="rounded-[10px] bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
                Sem senha, qualquer pessoa com o link consegue ver e trocar as respostas já
                enviadas. Ligue a senha para que só o cliente consiga.
              </p>
            )}
          </div>
        </section>

        {/* ── textos ── */}
        <section className="card p-5">
          <SectionTitle
            title="Textos que o cliente lê"
            subtitle="Opcional — se deixar vazio, entra um texto padrão."
          />
          <div className="mt-5 grid gap-4">
            <Field label="Abertura" hint="Aparece antes da primeira pergunta.">
              <Textarea
                rows={2}
                value={draft.intro}
                placeholder="Leva uns 5 minutos. Responda com calma."
                onChange={(e) => set('intro', e.target.value)}
              />
            </Field>
            <Field label="Agradecimento" hint="Aparece depois do envio.">
              <Textarea
                rows={2}
                value={draft.outro}
                placeholder="Recebido! Voltamos em até 2 dias úteis."
                onChange={(e) => set('outro', e.target.value)}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* ── aparência + prévia ── */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Preview draft={draft} questionCount={questionCount} />

        <section className="card p-5">
          <SectionTitle title="Aparência" />
          <div className="mt-4">
            <p className="mb-2.5 text-[13.5px] font-semibold text-ink-2">Cor do formulário</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const on = draft.theme.accent === a.hex
                return (
                  <motion.button
                    key={a.hex}
                    type="button"
                    title={a.name}
                    aria-label={a.name}
                    onClick={() => set('theme', { ...draft.theme, accent: a.hex })}
                    className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full"
                    style={{ background: a.hex }}
                    whileHover={{ scale: 1.12, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    transition={spring}
                  >
                    {on && (
                      <>
                        <motion.span
                          layoutId="accent-ring"
                          className="absolute -inset-[3px] rounded-full ring-2 ring-ink"
                          transition={spring}
                        />
                        <motion.svg
                          initial={{ scale: 0, rotate: -40 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={spring}
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{ color: readableOn(a.hex) }}
                        >
                          <path
                            d="m5 12.5 4.5 4.5L19 7.5"
                            stroke="currentColor"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      </>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="mt-5 space-y-4 border-t border-line-2 pt-4">
            <div>
              <p className="mb-2 text-[13.5px] font-semibold text-ink-2">Fundo</p>
              <Segmented
                id="surface"
                value={draft.theme.surface}
                onChange={(v) => set('theme', { ...draft.theme, surface: v })}
                options={[
                  { value: 'paper', label: 'Claro' },
                  { value: 'ink', label: 'Escuro' },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-[13.5px] font-semibold text-ink-2">Como o cliente responde</p>
              <div className="space-y-1.5">
                {FLOWS.map((f) => {
                  const on = draft.theme.flow === f.value
                  return (
                    <motion.button
                      key={f.value}
                      type="button"
                      onClick={() => set('theme', { ...draft.theme, flow: f.value })}
                      whileTap={{ scale: 0.99 }}
                      transition={spring}
                      className={cn(
                        'flex w-full cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 text-left transition-colors',
                        on ? 'border-brand bg-brand-soft/60' : 'border-line hover:border-ink-4',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2',
                          on ? 'border-brand' : 'border-line',
                        )}
                      >
                        {on && <span className="h-2 w-2 rounded-full bg-brand" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('text-[13.5px] font-bold', on ? 'text-brand' : 'text-ink')}>
                            {f.label}
                          </span>
                          {f.tip && <Badge tone="brand">{f.tip}</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">
                          {f.blurb}
                        </span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

      </aside>
    </div>
  )
}

/* ── recadinhos do endereço ─────────────────────────────── */

function SlugHint({
  state,
  auto,
  error,
}: {
  state: SlugState
  auto: boolean
  error: string | null
}) {
  if (error) return <span className="block text-[12.5px] font-medium text-danger">{error}</span>
  const map: Record<SlugState, { text: string; cls: string }> = {
    empty: { text: 'Preencha o título para gerar o endereço.', cls: 'text-ink-3' },
    checking: { text: 'Conferindo se está livre…', cls: 'text-ink-3' },
    free: {
      text: auto ? 'Endereço gerado e disponível.' : 'Endereço disponível.',
      cls: 'text-ok',
    },
    taken: { text: 'Esse endereço já está em uso — escolha outro.', cls: 'text-danger' },
  }
  const m = map[state]
  return <span className={cn('block text-[12.5px] font-medium', m.cls)}>{m.text}</span>
}

function SlugMark({ state }: { state: SlugState }) {
  if (state === 'checking')
    return (
      <motion.span
        className="block h-3.5 w-3.5 rounded-full border-2 border-ink-4 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
      />
    )
  if (state === 'free')
    return (
      <motion.svg
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={springPop}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="text-ok"
      >
        <path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    )
  if (state === 'taken')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-danger">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  return null
}

/* ── logo da equipe ─────────────────────────────────────── */

function LogoPicker({
  value,
  bg,
  onChange,
}: {
  value: string | null
  bg: string | null
  onChange: (v: string | null, bg: string | null) => void
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [asDefault, setAsDefault] = useState(() => !!getDefaultLogo())

  // Logo que entrou antes desta versão não tem cor guardada — descobre agora,
  // para a imagem encostar no fundo dela em vez de num quadrado branco.
  // Logo que entrou antes desta versão não tem cor guardada. A gente descobre
  // e oferece — sem aplicar sozinho, senão o formulário nasceria "alterado"
  // só de abrir a tela.
  const [sugestao, setSugestao] = useState<string | null>(null)
  const jaOlhou = useRef<string | null>(null)
  useEffect(() => {
    if (!value) {
      jaOlhou.current = null
      setSugestao(null)
      return
    }
    // A cor descoberta fica guardada mesmo depois de aplicada. Antes ela
    // era apagada, e como a mesma logo não é analisada duas vezes, clicar
    // em "tirar" sumia com o controle de vez.
    if (jaOlhou.current === value) return
    jaOlhou.current = value
    void detectLogoBg(value).then(setSugestao)
  }, [value])

  async function pick(file: File) {
    setBusy(true)
    try {
      const logo = await fileToLogo(file)
      onChange(logo.url, logo.bg)
      if (asDefault) setDefaultLogo(logo)
      toast(logo.bg ? 'Logo aplicada, com a cor de fundo dela.' : 'Logo aplicada.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui usar essa imagem.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13.5px] font-semibold text-ink-2">Logo da equipe</p>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null, null)
              if (asDefault) setDefaultLogo(null)
            }}
            className="cursor-pointer text-[12.5px] font-semibold text-ink-3 hover:text-danger"
          >
            Remover
          </button>
        )}
      </div>

      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={spring}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[16px] border px-4 py-5 text-center transition-colors',
          value
            ? 'border-line bg-surface-2'
            : 'border-dashed border-line bg-surface hover:border-brand hover:bg-brand-soft/40',
        )}
      >
        <span
          className="grid min-h-[10rem] w-full place-items-center overflow-hidden rounded-[12px] border border-line px-3 py-4 transition-colors"
          style={{ background: bg ?? '#ffffff' }}
        >
          {value ? (
            <motion.img
              key={value.slice(-24)}
              src={value}
              alt="Logo"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
              className="max-h-36 max-w-full object-contain"
            />
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="text-ink-4">
              <rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="9" cy="10" r="1.6" fill="currentColor" />
              <path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">
            {busy ? 'Processando…' : value ? 'Trocar logo' : 'Enviar logo'}
          </span>
          <span className="block text-[12px] text-ink-3">PNG, JPG, SVG ou WebP</span>
        </span>
      </motion.button>

      {value && (bg || sugestao) && (
        <button
          type="button"
          onClick={() => onChange(value, bg ? null : sugestao)}
          className={cn(
            'mt-2 flex w-full cursor-pointer items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-left transition-colors',
            bg ? 'border-line hover:border-ink-4' : 'border-brand bg-brand-soft/50',
          )}
        >
          <span
            className="h-4 w-4 shrink-0 rounded-[5px] border border-line"
            style={{ background: bg ?? sugestao ?? undefined }}
          />
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-3">
            {bg ? 'Usando o fundo da logo ' : 'Essa logo tem fundo '}
            <span className="font-mono text-ink-2">{bg ?? sugestao}</span>
          </span>
          <span
            className={cn(
              'shrink-0 text-[12px] font-bold',
              bg ? 'text-ink-3' : 'text-brand',
            )}
          >
            {bg ? 'tirar' : 'usar'}
          </span>
        </button>
      )}

      <label className="mt-2.5 flex cursor-pointer items-start gap-2 select-none">
        <input
          type="checkbox"
          checked={asDefault}
          onChange={(e) => {
            setAsDefault(e.target.checked)
            setDefaultLogo(e.target.checked && value ? { url: value, bg } : null)
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
        />
        <span className="text-[12.5px] leading-snug text-ink-3">
          Usar essa logo em todos os formulários novos
        </span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ── prévia ─────────────────────────────────────────────── */

function Preview({
  draft,
  questionCount,
}: {
  draft: Omit<DraftForm, 'questions'>
  questionCount: number
}) {
  const dark = draft.theme.surface === 'ink'
  const accent = draft.theme.accent
  const bg = dark ? '#171a21' : '#ffffff'
  const canvas = dark ? '#0f1115' : `color-mix(in srgb, ${accent} 8%, #f5f6fa)`
  const fg = dark ? '#f4f5f8' : '#16181f'
  const muted = dark ? 'rgba(244,245,248,0.55)' : '#868da1'
  const line = dark ? 'rgba(244,245,248,0.14)' : '#e2e6f0'
  const accentText = accentOnSurface(accent, bg, fg)

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-[13.5px] font-semibold text-ink-2">Prévia do cliente</p>
        <div className="flex gap-1.5">
          <Badge>{draft.password ? 'com senha' : 'sem senha'}</Badge>
          {draft.allow_edit && <Badge tone="brand">editável</Badge>}
        </div>
      </div>

      <div className="mt-3 p-4 transition-colors duration-300" style={{ background: canvas }}>
        <motion.div
          layout
          className="overflow-hidden rounded-[14px] shadow-sm"
          style={{ background: bg, border: `1px solid ${line}` }}
        >
          <motion.div layout className="h-2.5 w-full" style={{ background: accent }} />
          <div className="p-4">
            {draft.theme.logo && (
              <span
                className="mb-3 inline-grid place-items-center overflow-hidden rounded-[9px]"
                style={
                  draft.theme.logoBg
                    ? { background: draft.theme.logoBg, padding: '6px 9px' }
                    : undefined
                }
              >
                <img
                  src={draft.theme.logo}
                  alt=""
                  className="max-h-16 w-auto max-w-[190px] object-contain"
                />
              </span>
            )}
            <p className="text-[11.5px] font-bold" style={{ color: accentText }}>
              {draft.client_name || 'Cliente'}
            </p>
            <p className="mt-1 text-[17px] leading-tight font-extrabold" style={{ color: fg }}>
              {draft.title || 'Título do formulário'}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: muted }}>
              {draft.intro || 'Leva uns 5 minutos. Responda com calma.'}
            </p>
            <p
              className="mt-3 border-t pt-2.5 text-[11.5px]"
              style={{ borderColor: line, color: muted }}
            >
              {questionCount || 1} perguntas · cerca de{' '}
              {Math.max(2, Math.round((questionCount || 1) * 0.5))} min
            </p>
          </div>
        </motion.div>

        <div
          className="mt-2.5 rounded-[14px] p-4"
          style={{ background: bg, border: `1px solid ${line}` }}
        >
          <p className="text-[13px] font-semibold" style={{ color: fg }}>
            Primeira pergunta aparece aqui
            <span style={{ color: '#e11d48' }}> *</span>
          </p>
          <div className="mt-3 h-[30px] rounded-[8px]" style={{ border: `1px solid ${line}` }} />
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px]" style={{ color: muted }}>
            {draft.theme.flow === 'steps'
              ? `1 de ${questionCount || 1}`
              : draft.theme.flow === 'cards'
                ? `${questionCount || 1} perguntas na tela`
                : `${questionCount || 1} perguntas na página`}
          </span>
          <span
            className="rounded-full px-3.5 py-1.5 text-[11.5px] font-bold"
            style={{ background: accent, color: readableOn(accent) }}
          >
            {draft.theme.flow === 'steps' ? 'Próxima' : 'Enviar'}
          </span>
        </div>
      </div>
    </section>
  )
}

/* ══════════════ 04 · pronto ══════════════ */

function StepDone({
  slug,
  password,
  title,
  accent,
  onOpenPanel,
}: {
  slug: string
  password: string
  title: string
  accent: string
  onOpenPanel: () => void
}) {
  const toast = useToast()
  const scope = useRef<HTMLDivElement>(null)
  const url = publicUrl(slug)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-d]', {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        delay: 0.3,
        ease: 'expo.out',
      })
    }, scope)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={scope} className="mx-auto max-w-xl py-4 text-center">
      <div className="flex justify-center">
        <CheckBurst color={accent} size={92} />
      </div>

      <h2 data-d className="mt-5 text-[clamp(1.7rem,5vw,2.3rem)] font-extrabold tracking-[-0.035em]">
        Formulário criado!
      </h2>
      <p data-d className="mt-2 text-[15px] text-ink-3">
        Copia o bloco abaixo e cola direto no WhatsApp ou no e-mail do cliente.
      </p>

      <div data-d className="mt-7 text-left">
        <ShareBlock url={url} password={password} accent={accent} />
      </div>

      <div data-d className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const ok = await copy(
              `Oi! Segue o formulário${title ? ` "${title}"` : ''}:

${shareText(url, password)}`,
            )
            toast(ok ? 'Mensagem com saudação copiada.' : 'Não consegui copiar.', ok ? 'ok' : 'error')
          }}
        >
          Copiar com saudação
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.open(`/${slug}`, '_blank')}>
          Ver como cliente ↗
        </Button>
      </div>

      <div data-d className="mt-7">
        <Button size="lg" onClick={onOpenPanel}>
          Ir para o formulário no painel
        </Button>
      </div>
    </div>
  )
}
