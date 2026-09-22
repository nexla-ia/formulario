import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { deleteForm, listForms } from '../lib/db'
import type { FormRecord, FormStatus } from '../lib/types'
import { cn, copy, publicUrl, readableOn, timeAgo } from '../lib/utils'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, CountUp, Empty, SectionTitle } from '../components/ui/Chrome'
import { Confirm, Skeleton, useToast } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/Field'
import { listItem, listParent, pageVariants, spring } from '../lib/anim'

const STATUS: Record<FormStatus, { label: string; tone: 'neutral' | 'ok' | 'warn' }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  published: { label: 'No ar', tone: 'ok' },
  closed: { label: 'Encerrado', tone: 'warn' },
}

type Filter = 'all' | FormStatus | 'answered' | 'unanswered'

const FILTERS: { value: Filter; label: string; tone?: 'ok' | 'warn' | 'brand' }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'published', label: 'No ar', tone: 'ok' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'closed', label: 'Encerrados', tone: 'warn' },
  { value: 'answered', label: 'Respondidos', tone: 'brand' },
  { value: 'unanswered', label: 'Sem resposta' },
]

const answersOf = (f: FormRecord) => f.response_count ?? 0

function matchesFilter(f: FormRecord, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'answered') return answersOf(f) > 0
  if (filter === 'unanswered') return answersOf(f) === 0
  return f.status === filter
}

type Sort = 'recent' | 'answers' | 'title'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'answers', label: 'Mais respostas' },
  { value: 'title', label: 'Título (A–Z)' },
]

const EMPTY_COPY: Record<Filter, { title: string; body: string }> = {
  all: {
    title: 'Nenhum formulário ainda',
    body: 'Sobe a primeira planilha de perguntas e o formulário nasce pronto para mandar.',
  },
  published: {
    title: 'Nenhum formulário no ar',
    body: 'Publique um rascunho em Ajustes → Situação para o cliente conseguir responder.',
  },
  draft: { title: 'Nenhum rascunho', body: 'Todos os seus formulários já saíram do rascunho.' },
  closed: { title: 'Nenhum encerrado', body: 'Nada foi fechado para novas respostas ainda.' },
  answered: {
    title: 'Ninguém respondeu ainda',
    body: 'Assim que o primeiro cliente enviar, o formulário aparece aqui.',
  },
  unanswered: {
    title: 'Todos já têm resposta',
    body: 'Nenhum formulário está esperando o cliente.',
  },
}

const STAT_TONE = {
  brand: { text: 'text-brand', chip: 'bg-brand-soft text-brand', glow: 'bg-brand/25' },
  ok: { text: 'text-ok', chip: 'bg-ok-soft text-ok', glow: 'bg-ok/25' },
  ink: { text: 'text-ink', chip: 'bg-canvas-2 text-ink-2', glow: 'bg-ink/10' },
  warn: { text: 'text-warn', chip: 'bg-warn-soft text-warn', glow: 'bg-warn/25' },
}

function IcoDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3.5h7L19 9v11.5H6.5z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M13 3.5V9h6" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  )
}

function IcoLive() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 17.4a7.6 7.6 0 0 0 0-10.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function IcoAsk() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 9.2a3 3 0 1 1 3.9 2.9c-.7.2-1.1.9-1.1 1.6v.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="11.8" cy="17.6" r="1.2" fill="currentColor" />
    </svg>
  )
}

function IcoInbox() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 13.5h4l1.4 2.4h5.2L16 13.5h4M4 13.5 6.3 5.5h11.4L20 13.5v5H4z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  )
}

export default function Dashboard() {
  const [forms, setForms] = useState<FormRecord[] | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [toDelete, setToDelete] = useState<FormRecord | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    listForms()
      .then(setForms)
      .catch(() => setForms([]))
  }, [])

  const stats = useMemo(() => {
    const all = forms ?? []
    return {
      total: all.length,
      live: all.filter((f) => f.status === 'published').length,
      questions: all.reduce((n, f) => n + f.questions.length, 0),
      answers: all.reduce((n, f) => n + (f.response_count ?? 0), 0),
    }
  }, [forms])

  /** Quantos formulários cada filtro devolveria — mostrado no próprio chip. */
  const counts = useMemo(() => {
    const all = forms ?? []
    return Object.fromEntries(
      FILTERS.map((f) => [f.value, all.filter((x) => matchesFilter(x, f.value)).length]),
    ) as Record<Filter, number>
  }, [forms])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = (forms ?? []).filter((f) => {
      if (!matchesFilter(f, filter)) return false
      if (!term) return true
      return [f.title, f.client_name, f.slug].some((v) => (v ?? '').toLowerCase().includes(term))
    })
    const sorted = [...list]
    if (sort === 'answers') sorted.sort((a, b) => answersOf(b) - answersOf(a))
    else if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    else sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return sorted
  }, [forms, q, filter, sort])

  const filtering = filter !== 'all' || !!q.trim()

  async function remove(f: FormRecord) {
    await deleteForm(f.id)
    setForms((prev) => (prev ?? []).filter((x) => x.id !== f.id))
    toast(`"${f.title}" foi apagado.`)
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit">
      {/* ── cabeçalho ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.9rem,4vw,2.4rem)] font-extrabold tracking-[-0.035em]">
            Meus formulários
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-3">
            Cada formulário vira um link exclusivo para um cliente.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate('/painel/novo')}
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          }
        >
          Criar formulário
        </Button>
      </div>

      {/* ── números ── */}
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Formulários', value: stats.total, tone: 'brand' as const, icon: <IcoDoc /> },
          { label: 'No ar', value: stats.live, tone: 'ok' as const, icon: <IcoLive /> },
          { label: 'Perguntas', value: stats.questions, tone: 'ink' as const, icon: <IcoAsk /> },
          { label: 'Respostas', value: stats.answers, tone: 'warn' as const, icon: <IcoInbox /> },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3 }}
            className="card group relative overflow-hidden px-4 py-4"
          >
            {/* brilho que acompanha o tom do número */}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100',
                STAT_TONE[s.tone].glow,
              )}
            />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-ink-3">{s.label}</p>
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-[9px]',
                  STAT_TONE[s.tone].chip,
                )}
              >
                {s.icon}
              </span>
            </div>
            <p
              className={cn(
                'relative mt-1 text-[30px] leading-none font-extrabold tabular-nums',
                STAT_TONE[s.tone].text,
              )}
            >
              {forms === null ? (
                <span className="text-ink-4">—</span>
              ) : (
                <CountUp value={s.value} delay={140 + i * 70} />
              )}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── busca + ordenação ── */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="min-w-[15rem] flex-1">
          <Input
            placeholder="Buscar por título, cliente ou link…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            prefix={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            suffix={
              q ? (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Limpar busca"
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-canvas-2 hover:text-ink"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : undefined
            }
          />
        </div>

        <label className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[13px] font-semibold text-ink-3 sm:block">Ordenar</span>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 w-[11.5rem]"
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* ── chips de filtro ── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = counts[f.value] ?? 0
          const active = filter === f.value
          const empty = n === 0 && f.value !== 'all'
          return (
            <motion.button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={spring}
              className={cn(
                'relative flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                active
                  ? 'border-transparent text-white'
                  : empty
                    ? 'border-line bg-surface text-ink-4 hover:text-ink-3'
                    : 'border-line bg-surface text-ink-2 hover:border-ink-4 hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="filter-pill"
                  className={cn(
                    'absolute inset-0 rounded-full',
                    f.tone === 'ok'
                      ? 'bg-ok'
                      : f.tone === 'warn'
                        ? 'bg-warn'
                        : f.tone === 'brand'
                          ? 'bg-brand'
                          : 'bg-ink',
                  )}
                  transition={spring}
                />
              )}
              <span className="relative">{f.label}</span>
              <span
                className={cn(
                  'relative rounded-full px-1.5 py-px text-[11.5px] font-bold tabular-nums',
                  active ? 'bg-white/25 text-white' : 'bg-canvas-2 text-ink-3',
                )}
              >
                {forms === null ? '–' : n}
              </span>
            </motion.button>
          )
        })}

        <AnimatePresence>
          {filtering && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring}
              onClick={() => {
                setFilter('all')
                setQ('')
              }}
              className="cursor-pointer rounded-full px-3 py-2 text-[13px] font-semibold text-ink-3 hover:text-danger"
            >
              Limpar
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── resumo do resultado ── */}
      {forms !== null && filtering && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-[13px] text-ink-3"
        >
          <b className="font-bold text-ink">{visible.length}</b> de {forms.length}{' '}
          {forms.length === 1 ? 'formulário' : 'formulários'}
          {q.trim() && <> para “{q.trim()}”</>}
        </motion.p>
      )}

      {/* ── grade ── */}
      <div className="mt-5">
        {forms === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card overflow-hidden">
                <Skeleton className="h-[76px] rounded-none" />
                <div className="space-y-2.5 p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Empty
            title={q.trim() ? 'Nada encontrado' : EMPTY_COPY[filter].title}
            body={
              q.trim()
                ? 'Nenhum formulário bate com essa busca. Tenta outro termo ou limpa o filtro.'
                : EMPTY_COPY[filter].body
            }
            action={
              filtering ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ('')
                    setFilter('all')
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => navigate('/painel/novo')}>Criar o primeiro</Button>
              )
            }
          />
        ) : (
          <motion.ul
            variants={listParent}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {visible.map((f) => (
                <FormCard
                  key={f.id}
                  form={f}
                  onDelete={() => setToDelete(f)}
                  onCopy={async () => {
                    const ok = await copy(publicUrl(f.slug))
                    toast(ok ? 'Link copiado.' : 'Não consegui copiar.', ok ? 'ok' : 'error')
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      {/* ── como funciona ── */}
      <div className="mt-14">
        <SectionTitle title="Como funciona" subtitle="Três passos, do arquivo ao link." />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              t: 'Sobe a planilha',
              d: 'Uma pergunta por linha. O sistema entende o tipo de cada campo sozinho.',
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
              t: 'Ajusta e configura',
              d: 'Tipo, ordem, seções, cor, senha e o endereço do link — tudo na mão.',
              icon: (
                <path
                  d="M5 7h14M5 12h9M5 17h5M17.5 14.5v6M14.5 17.5h6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ),
            },
            {
              t: 'Manda e acompanha',
              d: 'Link único por cliente. As respostas caem no painel e saem em planilha.',
              icon: (
                <path
                  d="M4 6.5 12 12l8-5.5M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            },
          ].map((s, i) => (
            <motion.div
              key={s.t}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="card p-5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-[13px] bg-brand-soft text-brand">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  {s.icon}
                </svg>
              </div>
              <p className="mt-4 text-[16px] font-bold tracking-[-0.02em]">{s.t}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <Confirm
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
        title="Apagar formulário"
        body={`"${toDelete?.title}" e todas as respostas dele somem. Não dá para desfazer.`}
        confirmLabel="Apagar mesmo"
        danger
      />
    </motion.div>
  )
}

/* ══════════════ cartão ══════════════ */

/** Inicial do cliente — ou do título, quando não há cliente. */
function monogram(f: FormRecord): string {
  const base = (f.client_name || f.title || '?').trim()
  return (base[0] ?? '?').toUpperCase()
}

function FormCard({
  form: f,
  onDelete,
  onCopy,
}: {
  form: FormRecord
  onDelete: () => void
  onCopy: () => void
}) {
  const accent = f.theme.accent
  const onAccent = readableOn(accent)

  return (
    <motion.li
      layout
      variants={listItem}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
      whileHover={{ y: -5 }}
      transition={spring}
      className="group card overflow-hidden hover:shadow-lg"
    >
      <Link to={`/painel/f/${f.id}`} className="block">
        {/* capa colorida */}
        <div className="relative h-[84px] overflow-hidden" style={{ background: accent }}>
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `repeating-linear-gradient(135deg, ${onAccent}33 0 2px, transparent 2px 13px)`,
            }}
          />
          <motion.div
            aria-hidden
            className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full"
            style={{ background: onAccent, opacity: 0.14 }}
            initial={false}
            whileHover={{ scale: 1.25 }}
            transition={spring}
          />
          {/*
            Aqui tinha três barrinhas cinzas imitando texto. Parecia
            carregamento travado. Agora a capa mostra a marca do formulário —
            a logo que a equipe subiu, ou a inicial do cliente.
          */}
          <div className="relative flex h-full items-center px-4">
            <motion.span
              className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[14px] shadow-sm"
              style={{
                background: f.theme.logo ? (f.theme.logoBg ?? '#ffffff') : `${onAccent}2e`,
                color: onAccent,
              }}
              initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ ...spring, delay: 0.08 }}
              whileHover={{ rotate: -5, scale: 1.06 }}
            >
              {f.theme.logo ? (
                <img src={f.theme.logo} alt="" className="max-h-12 max-w-12 object-contain" />
              ) : (
                <span className="text-[22px] leading-none font-extrabold">{monogram(f)}</span>
              )}
            </motion.span>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {f.password && (
              <span
                className="grid h-6 w-6 place-items-center rounded-full"
                style={{ background: `${onAccent}26`, color: onAccent }}
                title="Protegido por senha"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4.5"
                    y="10.5"
                    width="15"
                    height="10"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            )}
          </div>
        </div>

        <div className="px-4 pt-3.5 pb-3">
          <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink transition-colors group-hover:text-brand">
            {f.title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-ink-3">
            {f.client_name ? `${f.client_name} · ` : ''}/{f.slug}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Badge tone={STATUS[f.status].tone} dot>
              {STATUS[f.status].label}
            </Badge>
            <span className="text-[12.5px] text-ink-3">{f.questions.length} perguntas</span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-line-2 px-2.5 py-2">
        <div className="flex items-center gap-2 pl-1.5">
          <span
            className={cn(
              'text-[13px] font-bold',
              (f.response_count ?? 0) > 0 ? 'text-brand' : 'text-ink-4',
            )}
          >
            {f.response_count ?? 0}
          </span>
          <span className="text-[12.5px] text-ink-3">
            {f.response_count === 1 ? 'resposta' : 'respostas'}
          </span>
          <span className="text-[12px] text-ink-4">· {timeAgo(f.updated_at)}</span>
        </div>

        <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <IconButton label="Copiar link do cliente" size="sm" onClick={onCopy}>
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
          <IconButton
            label="Abrir como cliente"
            size="sm"
            onClick={() => window.open(`/${f.slug}`, '_blank')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 5h5v5M19 5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton label="Apagar" size="sm" tone="danger" onClick={onDelete}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
    </motion.li>
  )
}
