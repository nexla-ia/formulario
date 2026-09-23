import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { deleteForm, getForm, listResponses, slugTaken, updateForm } from '../lib/db'
import { exportResponses } from '../lib/sheet'
import { exportAllResponsesDocx, exportResponseDocx } from '../lib/docx'
import { NOTIFY_WEBHOOK, notifyFilled } from '../lib/notify'
import type { AnexoFile, FormRecord, Question, ResponseRecord } from '../lib/types'
import {
  answerText,
  cn,
  fileSize,
  fullDate,
  isAnexoList,
  publicUrl,
  slugify,
  timeAgo,
} from '../lib/utils'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Empty, SectionTitle } from '../components/ui/Chrome'
import { Confirm, Skeleton, useToast } from '../components/ui/Feedback'
import QuestionList from '../components/QuestionList'
import ShareBlock from '../components/ShareBlock'
import { StepConfigure } from './NewForm'
import { pageVariants, spring } from '../lib/anim'

type Tab = 'perguntas' | 'ajustes' | 'respostas'
const TABS: { id: Tab; label: string }[] = [
  { id: 'perguntas', label: 'Perguntas' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'respostas', label: 'Respostas' },
]

const STATUS = {
  published: { label: 'No ar', tone: 'ok' as const },
  draft: { label: 'Rascunho', tone: 'neutral' as const },
  closed: { label: 'Encerrado', tone: 'warn' as const },
}

export default function FormDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [original, setOriginal] = useState<FormRecord | null>(null)
  const [form, setForm] = useState<FormRecord | null>(null)
  const [responses, setResponses] = useState<ResponseRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('perguntas')
  const [saving, setSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    getForm(id).then((f) => {
      if (!alive) return
      if (!f) return setNotFound(true)
      setOriginal(f)
      setForm(f)
    })
    listResponses(id).then((r) => alive && setResponses(r))
    return () => {
      alive = false
    }
  }, [id])

  const dirty = useMemo(
    () => !!form && !!original && JSON.stringify(form) !== JSON.stringify(original),
    [form, original],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (notFound) {
    return (
      <div className="py-14">
        <Empty
          title="Esse formulário sumiu"
          body="Pode ter sido apagado ou o endereço está errado."
          action={<Button onClick={() => navigate('/painel')}>Voltar para o painel</Button>}
        />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const set = (patch: Partial<FormRecord>) => setForm((f) => (f ? { ...f, ...patch } : f))

  async function save() {
    if (!form) return
    const slug = slugify(form.slug)
    if (!slug) return setSlugError('Precisa de um endereço.')
    if (await slugTaken(slug, form.id)) return setSlugError('Esse endereço já está em uso.')
    setSlugError(null)
    setSaving(true)
    try {
      const saved = await updateForm(form.id, {
        title: form.title,
        client_name: form.client_name ?? '',
        description: form.description ?? '',
        slug,
        password: form.password ?? '',
        intro: form.intro ?? '',
        outro: form.outro ?? '',
        status: form.status,
        allow_edit: form.allow_edit,
        theme: form.theme,
        questions: form.questions.map((q, i) => ({ ...q, position: i + 1 })),
      })
      setOriginal(saved)
      setForm(saved)
      toast('Alterações salvas.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const url = publicUrl(form.slug)
  const accent = form.theme.accent
  const draftShape = {
    title: form.title,
    client_name: form.client_name ?? '',
    description: form.description ?? '',
    slug: form.slug,
    password: form.password ?? '',
    intro: form.intro ?? '',
    outro: form.outro ?? '',
    status: form.status,
    allow_edit: form.allow_edit,
    theme: form.theme,
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit">
      <button
        onClick={() => navigate('/painel')}
        className="mb-3 cursor-pointer text-[13.5px] font-semibold text-ink-3 transition-colors hover:text-ink"
      >
        ← Meus formulários
      </button>

      {/* ── cartão do formulário ── */}
      <div className="card overflow-hidden">
        <div className="relative h-2.5 w-full" style={{ background: accent }} />
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.5rem,3.6vw,2rem)] leading-tight font-extrabold tracking-[-0.035em]">
              {form.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={STATUS[form.status].tone} dot>
                {STATUS[form.status].label}
              </Badge>
              {form.client_name && <Badge>{form.client_name}</Badge>}
              {form.password && <Badge tone="brand">com senha</Badge>}
              {form.allow_edit && <Badge tone="neutral">cliente pode corrigir</Badge>}
              <span className="text-[12.5px] text-ink-3">editado {timeAgo(form.updated_at)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/${form.slug}`, '_blank')}
            >
              Ver como cliente ↗
            </Button>
            <IconButton label="Apagar formulário" tone="danger" onClick={() => setConfirmDelete(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.7 11.1A2 2 0 0 0 9.2 20h5.6a2 2 0 0 0 2-1.9L17.5 7"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* bloco pronto para mandar ao cliente */}
        <ShareBlock flat compact url={url} password={form.password} accent={accent} />

        {/* abas */}
        <div className="flex items-center gap-1 border-t border-line px-3 sm:px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative cursor-pointer px-3.5 py-3 text-[14px] font-semibold transition-colors',
                tab === t.id ? 'text-brand' : 'text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
              {t.id === 'respostas' && responses && responses.length > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                  {responses.length}
                </span>
              )}
              {tab === t.id && (
                <motion.span
                  layoutId="detail-tab"
                  className="absolute inset-x-1 -bottom-px h-[3px] rounded-full bg-brand"
                  transition={spring}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── conteúdo ── */}
      <div className="mt-6 min-h-[20rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === 'perguntas' && (
              <div className="mx-auto max-w-3xl">
                <QuestionList questions={form.questions} onChange={(questions) => set({ questions })} />
              </div>
            )}

            {tab === 'ajustes' && (
              <StepConfigure
                questionCount={form.questions.length}
                slugError={slugError}
                slugAuto={false}
                ignoreId={form.id}
                onSlugChange={(v) => {
                  setSlugError(null)
                  set({ slug: v })
                }}
                draft={draftShape}
                setDraft={(fn) => set(fn(draftShape) as Partial<FormRecord>)}
              />
            )}

            {tab === 'respostas' && <Answers form={form} responses={responses} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── barra de salvar ── */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={spring}
            className="sticky bottom-4 z-40 mt-8"
          >
            <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-lg">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-2">
                <motion.span
                  className="h-2 w-2 rounded-full bg-warn"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                Alterações não salvas
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm(original)
                    setSlugError(null)
                  }}
                >
                  Descartar
                </Button>
                <Button size="sm" loading={saving} onClick={save}>
                  Salvar alterações
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteForm(form.id)
          toast('Formulário apagado.')
          navigate('/painel')
        }}
        title="Apagar formulário"
        body={`"${form.title}" e ${responses?.length ?? 0} resposta(s) somem de vez.`}
        confirmLabel="Apagar mesmo"
        danger
      />
    </motion.div>
  )
}

/* ══════════════ respostas ══════════════ */

function Answers({
  form,
  responses,
}: {
  form: FormRecord
  responses: ResponseRecord[] | null
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [list, setList] = useState<ResponseRecord[] | null>(responses)
  const [avisando, setAvisando] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => setList(responses), [responses])

  /** Reenvia o aviso de preenchimento para o webhook da equipe. */
  async function avisar(r: ResponseRecord) {
    setAvisando(r.id)
    const preenchidas = form.questions.filter((q) => !!answerText(q.type, valueOf(r, q))).length
    const res = await notifyFilled(form, {
      evento: r.updated_at ? 'corrigido' : 'preenchido',
      respondente: r.respondent,
      respondidas: preenchidas,
      total: form.questions.length,
    })
    setAvisando(null)
    if (res.ok) toast('Aviso enviado.')
    else toast(`Webhook não aceitou. ${res.detail ?? ''}`.trim(), 'error')
  }

  async function word(target: ResponseRecord | 'all') {
    if (!list?.length) return
    const key = target === 'all' ? 'all' : target.id
    setBusy(key)
    try {
      if (target === 'all') await exportAllResponsesDocx(form, list)
      else await exportResponseDocx(form, target)
      toast('Resumo em Word gerado.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui gerar o Word.', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (list === null) return <Skeleton className="h-48 w-full" />

  if (list.length === 0) {
    return (
      <Empty
        title="Nenhuma resposta ainda"
        body="Assim que o cliente enviar, aparece aqui — e dá para exportar tudo em planilha."
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6.5 12 12l8-5.5M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    )
  }

  const latest = list[0]
  const older = list.slice(1)
  /** Formulário editável = uma resposta viva, não uma pilha de envios. */
  const documento = form.allow_edit

  const acoes = (r: ResponseRecord) => (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => void exportResponses(form.title, form.questions, list)}
        icon={<SheetIcon />}
      >
        Planilha
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={busy === r.id}
        onClick={() => void word(r)}
        icon={busy === r.id ? undefined : <WordIcon />}
      >
        Word
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={avisando === r.id}
        onClick={() => void avisar(r)}
        icon={avisando === r.id ? undefined : <BellIcon />}
        title={`Manda de novo o aviso para ${NOTIFY_WEBHOOK}`}
      >
        Reenviar aviso
      </Button>
    </div>
  )

  return (
    <div>
      {documento ? (
        <>
          <ResponseDoc form={form} r={latest} actions={acoes(latest)} />

          {older.length > 0 && (
            <div className="mt-8">
              <SectionTitle
                title="Envios anteriores"
                subtitle="De antes deste formulário virar editável. Ficam só como histórico."
              />
              <ul className="mt-4 space-y-2.5">
                {older.map((r) => (
                  <ResponseRow
                    key={r.id}
                    form={form}
                    r={r}
                    open={open === r.id}
                    onToggle={() => setOpen(open === r.id ? null : r.id)}
                    footer={acoes(r)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <SectionTitle
            title={`${list.length} ${list.length === 1 ? 'resposta' : 'respostas'}`}
            subtitle="Cada envio do cliente vira uma resposta nova. Clique para abrir."
            right={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void exportResponses(form.title, form.questions, list)}
                  icon={<SheetIcon />}
                >
                  Planilha
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  loading={busy === 'all'}
                  onClick={() => void word('all')}
                  icon={busy === 'all' ? undefined : <WordIcon />}
                >
                  Resumo em Word
                </Button>
              </div>
            }
          />
          <ul className="mt-5 space-y-2.5">
            {list.map((r) => (
              <ResponseRow
                key={r.id}
                form={form}
                r={r}
                open={open === r.id}
                onToggle={() => setOpen(open === r.id ? null : r.id)}
                footer={acoes(r)}
              />
            ))}
          </ul>
        </>
      )}

    </div>
  )
}

/* ── a resposta viva do cliente, aberta como documento ─── */

function ResponseDoc({
  form,
  r,
  actions,
}: {
  form: FormRecord
  r: ResponseRecord
  actions: React.ReactNode
}) {
  const preenchidas = form.questions.filter(
    (q) => !!answerText(q.type, valueOf(r, q)),
  ).length
  const total = form.questions.length
  const faltando = total - preenchidas
  const pct = total ? preenchidas / total : 0
  const completo = faltando === 0

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-bold tracking-[-0.02em]">Resposta do cliente</h2>
            <Badge tone={completo ? 'ok' : 'warn'} dot>
              {completo ? 'Completa' : `Faltam ${faltando}`}
            </Badge>
            {(r.edits ?? 0) > 0 && (
              <Badge tone="brand">
                {r.edits} {r.edits === 1 ? 'correção' : 'correções'}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            {r.respondent || 'Sem identificação'} · enviado em {fullDate(r.submitted_at)}
            {r.updated_at && ` · corrigido ${timeAgo(r.updated_at)}`}
          </p>
        </div>
        {actions}
      </div>

      {/* quanto já veio */}
      <div className="px-5 pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-2">
            <motion.div
              className={cn('h-full rounded-full', completo ? 'bg-ok' : 'bg-brand')}
              initial={{ width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink-2">
            {preenchidas}/{total}
          </span>
        </div>
        {!completo && (
          <p className="mt-2 text-[12.5px] text-ink-3">
            O cliente ainda pode reabrir o link e completar — as em branco aparecem marcadas
            abaixo.
          </p>
        )}
      </div>

      <dl className="border-t border-line bg-surface-2 px-5 py-1 sm:px-6">
        {form.questions.map((q, i) => {
          const text = answerText(q.type, valueOf(r, q))
          const novaSecao = q.section && q.section !== (form.questions[i - 1]?.section ?? null)
          return (
            <div key={q.id}>
              {novaSecao && (
                <p className="mt-5 mb-1 text-[11.5px] font-bold tracking-[0.06em] text-ink-3 uppercase first:mt-3">
                  {q.section}
                </p>
              )}
              <div className={cn('py-3', i > 0 && !novaSecao && 'border-t border-line-2')}>
                <dt className="flex gap-2 text-[12.5px] font-semibold text-ink-3">
                  <span className="tabular-nums text-ink-4">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {q.label}
                  {q.required && !text && <span className="text-danger">*</span>}
                </dt>
                {isAnexoList(valueOf(r, q)) ? (
                  <Anexos arquivos={valueOf(r, q) as AnexoFile[]} />
                ) : (
                  <dd
                    className={cn(
                      'mt-1 text-[14.5px] leading-relaxed whitespace-pre-line',
                      text ? 'text-ink' : 'text-warn italic',
                    )}
                  >
                    {text || 'em branco'}
                  </dd>
                )}
              </div>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/**
 * Os arquivos que o cliente anexou. O conteúdo já veio junto da resposta
 * em data URL, então o download é local — não busca nada em servidor.
 */
function Anexos({ arquivos }: { arquivos: AnexoFile[] }) {
  if (!arquivos.length) {
    return <dd className="mt-1 text-[14.5px] text-warn italic">em branco</dd>
  }
  return (
    <dd className="mt-1.5 flex flex-wrap gap-2">
      {arquivos.map((f, i) => (
        <a
          key={`${f.name}-${i}`}
          href={f.data}
          download={f.name}
          className="group flex max-w-full items-center gap-2.5 rounded-[11px] border border-line bg-surface px-3 py-2 transition-colors hover:border-brand"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v11M12 15l-4-4M12 15l4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 17.5v1.2a1.3 1.3 0 0 0 1.3 1.3h11.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-brand">
              {f.name}
            </span>
            <span className="block text-[12px] text-ink-3">{fileSize(f.size)} · baixar</span>
          </span>
        </a>
      ))}
    </dd>
  )
}

/* ── linha recolhível, para quando há vários envios ───── */

function ResponseRow({
  form,
  r,
  open,
  onToggle,
  footer,
}: {
  form: FormRecord
  r: ResponseRecord
  open: boolean
  onToggle: () => void
  footer: React.ReactNode
}) {
  const preenchidas = form.questions.filter((q) => !!answerText(q.type, valueOf(r, q))).length

  return (
    <motion.li
      layout
      className={cn(
        'overflow-hidden rounded-[16px] border bg-surface transition-shadow',
        open ? 'border-brand-line shadow-md' : 'border-line shadow-xs hover:shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas-2 text-ink-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6.5 12 12l8-5.5M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-ink">
            {r.respondent || 'Sem identificação'}
          </span>
          <span className="block text-[12.5px] text-ink-3">
            Enviado em {fullDate(r.submitted_at)}
            {r.updated_at && ` · corrigido em ${fullDate(r.updated_at)}`}
          </span>
        </span>
        {(r.edits ?? 0) > 0 && (
          <Badge tone="brand">
            {r.edits} {r.edits === 1 ? 'correção' : 'correções'}
          </Badge>
        )}
        <span className="shrink-0 text-[12.5px] font-semibold text-ink-3">
          {preenchidas}/{form.questions.length}
        </span>
        <motion.span className="text-ink-3" animate={{ rotate: open ? 180 : 0 }} transition={spring}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="m6 9.5 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <dl className="border-t border-line-2 bg-surface-2 px-4 py-2">
              {form.questions.map((q, qi) => {
                const text = answerText(q.type, valueOf(r, q))
                return (
                  <div key={q.id} className={cn('py-3', qi > 0 && 'border-t border-line-2')}>
                    <dt className="flex gap-2 text-[12.5px] font-semibold text-ink-3">
                      <span className="tabular-nums text-ink-4">
                        {String(qi + 1).padStart(2, '0')}
                      </span>
                      {q.label}
                    </dt>
                    {isAnexoList(valueOf(r, q)) ? (
                      <Anexos arquivos={valueOf(r, q) as AnexoFile[]} />
                    ) : (
                      <dd
                        className={cn(
                          'mt-1 text-[14.5px] leading-relaxed whitespace-pre-line',
                          text ? 'text-ink' : 'text-ink-4 italic',
                        )}
                      >
                        {text || 'em branco'}
                      </dd>
                    )}
                  </div>
                )
              })}
            </dl>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-2 bg-surface px-4 py-3">
              {footer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/** Acha a resposta de uma pergunta, por id ou pelo texto dela. */
function valueOf(r: ResponseRecord, q: Question) {
  const a = r.answers.find((x) => x.question_id === q.id) ?? r.answers.find((x) => x.label === q.label)
  return a?.value
}

function WordIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path
        d="m8.5 12 1.2 4.5L11 13l1.3 3.5 1.2-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SheetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M9 9.5V19M15 9.5V19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.2.8 4.8 1.5 5.7.4.5 0 1.3-.6 1.3H5.6c-.7 0-1-.8-.6-1.3.7-.9 1.5-2.5 1.5-5.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
