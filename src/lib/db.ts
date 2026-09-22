/**
 * Camada de dados.
 *
 * Dois backends com a mesma API:
 *   • "supabase" — usado assim que a tabela public.forms existir no projeto.
 *   • "local"    — fallback em localStorage, para o app funcionar antes de rodar o SQL.
 *
 * O modo é detectado uma vez no boot (initBackend) e exposto em `getBackend()`.
 */
import { supabase, hasSupabaseConfig } from './supabase'
import {
  DEFAULT_THEME,
  type DraftForm,
  type FormRecord,
  type FormTheme,
  type ResponseRecord,
  type AnswerValue,
} from './types'

export type Backend = 'supabase' | 'local'

const LS_FORMS = 'dossie:forms'
const LS_RESPONSES = 'dossie:responses'

let backend: Backend = 'local'
/** A sondagem roda uma vez só; chamadas concorrentes esperam a mesma promise
 *  (o StrictMode dispara o efeito duas vezes). */
let probe: Promise<Backend> | null = null

export function getBackend(): Backend {
  return backend
}

export function initBackend(): Promise<Backend> {
  if (!probe) probe = detectBackend()
  return probe
}

async function detectBackend(): Promise<Backend> {
  if (!hasSupabaseConfig || !supabase) return (backend = 'local')
  try {
    const { error } = await supabase.from('forms').select('id').limit(1)
    backend = error ? 'local' : 'supabase'
  } catch {
    backend = 'local'
  }
  return backend
}

/* ───────────────────────── helpers ───────────────────────── */

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

function readLS<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeLS<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota — ignora */
  }
}

function hydrate(row: Record<string, any>): FormRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    client_name: row.client_name ?? null,
    intro: row.intro ?? null,
    outro: row.outro ?? null,
    password: row.password ?? null,
    status: row.status ?? 'draft',
    allow_edit: row.allow_edit ?? true,
    theme: { ...DEFAULT_THEME, ...(row.theme ?? {}) } as FormTheme,
    questions: Array.isArray(row.questions) ? row.questions : [],
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    response_count: row.response_count,
  }
}

function draftToRow(draft: Partial<DraftForm>) {
  const row: Record<string, unknown> = {}
  if (draft.title !== undefined) row.title = draft.title
  if (draft.slug !== undefined) row.slug = draft.slug
  if (draft.description !== undefined) row.description = draft.description || null
  if (draft.client_name !== undefined) row.client_name = draft.client_name || null
  if (draft.intro !== undefined) row.intro = draft.intro || null
  if (draft.outro !== undefined) row.outro = draft.outro || null
  if (draft.password !== undefined) row.password = draft.password || null
  if (draft.status !== undefined) row.status = draft.status
  if (draft.allow_edit !== undefined) row.allow_edit = draft.allow_edit
  if (draft.theme !== undefined) row.theme = draft.theme
  if (draft.questions !== undefined) row.questions = draft.questions
  return row
}

/* ───────────────────────── painel (admin) ───────────────────────── */

export async function listForms(): Promise<FormRecord[]> {
  if (backend === 'supabase' && supabase) {
    const [{ data: forms, error }, { data: counts }] = await Promise.all([
      supabase.from('forms').select('*').order('created_at', { ascending: false }),
      supabase.from('responses').select('form_id'),
    ])
    if (error) throw error
    const tally = new Map<string, number>()
    for (const r of counts ?? []) tally.set(r.form_id, (tally.get(r.form_id) ?? 0) + 1)
    return (forms ?? []).map((f) => hydrate({ ...f, response_count: tally.get(f.id) ?? 0 }))
  }
  const forms = readLS<FormRecord>(LS_FORMS)
  const responses = readLS<ResponseRecord>(LS_RESPONSES)
  return forms
    .map((f) =>
      hydrate({ ...f, response_count: responses.filter((r) => r.form_id === f.id).length }),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getForm(id: string): Promise<FormRecord | null> {
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('forms').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? hydrate(data) : null
  }
  const found = readLS<FormRecord>(LS_FORMS).find((f) => f.id === id)
  return found ? hydrate(found) : null
}

export async function slugTaken(slug: string, ignoreId?: string): Promise<boolean> {
  if (backend === 'supabase' && supabase) {
    const { data } = await supabase.from('forms').select('id').eq('slug', slug).limit(1)
    return (data ?? []).some((r) => r.id !== ignoreId)
  }
  return readLS<FormRecord>(LS_FORMS).some((f) => f.slug === slug && f.id !== ignoreId)
}

export async function createForm(draft: DraftForm): Promise<FormRecord> {
  const now = new Date().toISOString()
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase
      .from('forms')
      .insert(draftToRow(draft))
      .select('*')
      .single()
    if (error) throw error
    return hydrate(data)
  }
  const record: FormRecord = {
    id: uid(),
    slug: draft.slug,
    title: draft.title,
    description: draft.description || null,
    client_name: draft.client_name || null,
    intro: draft.intro || null,
    outro: draft.outro || null,
    password: draft.password || null,
    status: draft.status,
    allow_edit: draft.allow_edit,
    theme: draft.theme,
    questions: draft.questions,
    created_at: now,
    updated_at: now,
  }
  const all = readLS<FormRecord>(LS_FORMS)
  all.push(record)
  writeLS(LS_FORMS, all)
  return record
}

export async function updateForm(id: string, patch: Partial<DraftForm>): Promise<FormRecord> {
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase
      .from('forms')
      .update({ ...draftToRow(patch), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return hydrate(data)
  }
  const all = readLS<FormRecord>(LS_FORMS)
  const i = all.findIndex((f) => f.id === id)
  if (i < 0) throw new Error('Formulário não encontrado')
  all[i] = { ...all[i], ...(patch as object), updated_at: new Date().toISOString() } as FormRecord
  writeLS(LS_FORMS, all)
  return hydrate(all[i])
}

export async function deleteForm(id: string): Promise<void> {
  if (backend === 'supabase' && supabase) {
    const { error } = await supabase.from('forms').delete().eq('id', id)
    if (error) throw error
    return
  }
  writeLS(
    LS_FORMS,
    readLS<FormRecord>(LS_FORMS).filter((f) => f.id !== id),
  )
  writeLS(
    LS_RESPONSES,
    readLS<ResponseRecord>(LS_RESPONSES).filter((r) => r.form_id !== id),
  )
}

export async function listResponses(formId: string): Promise<ResponseRecord[]> {
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ResponseRecord[]
  }
  return readLS<ResponseRecord>(LS_RESPONSES)
    .filter((r) => r.form_id === formId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
}

/* ───────────────────────── página pública ───────────────────────── */

export interface PublicFormMeta {
  found: boolean
  locked: boolean
  status: 'draft' | 'published' | 'closed'
  id: string
  slug: string
  title: string
  description: string | null
  client_name: string | null
  intro: string | null
  theme: FormTheme
}

/** Metadados do formulário sem expor perguntas nem senha. */
export async function getPublicMeta(slug: string): Promise<PublicFormMeta | null> {
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase.rpc('form_public', { p_slug: slug })
    if (!error && data) {
      const row = data as Record<string, any>
      return {
        found: true,
        locked: Boolean(row.locked),
        status: row.status,
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description ?? null,
        client_name: row.client_name ?? null,
        intro: row.intro ?? null,
        theme: { ...DEFAULT_THEME, ...(row.theme ?? {}) },
      }
    }
    // RPC ausente (schema antigo) → leitura direta
    const { data: row } = await supabase.from('forms').select('*').eq('slug', slug).maybeSingle()
    if (!row) return null
    const f = hydrate(row)
    return metaFrom(f)
  }
  const f = readLS<FormRecord>(LS_FORMS).find((x) => x.slug === slug)
  return f ? metaFrom(hydrate(f)) : null
}

function metaFrom(f: FormRecord): PublicFormMeta {
  return {
    found: true,
    locked: Boolean(f.password),
    status: f.status,
    id: f.id,
    slug: f.slug,
    title: f.title,
    description: f.description,
    client_name: f.client_name,
    intro: f.intro,
    theme: f.theme,
  }
}

export interface UnlockResult {
  ok: boolean
  reason?: 'password' | 'closed' | 'draft' | 'missing'
  form?: FormRecord
  /** o que o cliente já tinha enviado, para a tela abrir preenchida */
  response?: ResponseRecord | null
}

/** Troca a senha pelas perguntas. Sem senha configurada, devolve direto. */
export async function unlockForm(slug: string, password: string): Promise<UnlockResult> {
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase.rpc('form_unlock', {
      p_slug: slug,
      p_password: password || '',
    })
    if (!error && data) {
      const row = data as Record<string, any>
      if (row.ok) {
        return {
          ok: true,
          form: hydrate(row.form),
          response: row.response ? ({ ...row.response, form_id: row.form.id } as ResponseRecord) : null,
        }
      }
      return { ok: false, reason: row.reason }
    }
    const { data: raw } = await supabase.from('forms').select('*').eq('slug', slug).maybeSingle()
    if (!raw) return { ok: false, reason: 'missing' }
    return localUnlock(hydrate(raw), password)
  }
  const f = readLS<FormRecord>(LS_FORMS).find((x) => x.slug === slug)
  if (!f) return { ok: false, reason: 'missing' }
  return localUnlock(hydrate(f), password)
}

function localUnlock(f: FormRecord, password: string): UnlockResult {
  if (f.status === 'closed') return { ok: false, reason: 'closed' }
  if (f.status === 'draft') return { ok: false, reason: 'draft' }
  if (f.password && f.password !== password) return { ok: false, reason: 'password' }
  const previous = f.allow_edit
    ? readLS<ResponseRecord>(LS_RESPONSES)
        .filter((r) => r.form_id === f.id)
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0]
    : undefined
  return { ok: true, form: f, response: previous ?? null }
}

export type SubmitMode = 'created' | 'updated'

export async function submitResponse(input: {
  slug: string
  password: string
  answers: AnswerValue[]
  respondent: string | null
}): Promise<SubmitMode> {
  const meta = {
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    at: new Date().toISOString(),
  }
  if (backend === 'supabase' && supabase) {
    const { data, error } = await supabase.rpc('form_submit', {
      p_slug: input.slug,
      p_password: input.password || '',
      p_answers: input.answers,
      p_respondent: input.respondent,
      p_meta: meta,
    })
    if (!error && data) {
      const row = data as Record<string, any>
      if (row.ok) return (row.mode as SubmitMode) ?? 'created'
      throw new Error(row.reason ?? 'Falha ao enviar')
    }
    const { data: raw } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', input.slug)
      .maybeSingle()
    if (!raw) throw new Error('missing')
    const { error: insErr } = await supabase.from('responses').insert({
      form_id: raw.id,
      respondent: input.respondent,
      answers: input.answers,
      meta,
    })
    if (insErr) throw insErr
    return 'created'
  }

  const forms = readLS<FormRecord>(LS_FORMS)
  const f = forms.find((x) => x.slug === input.slug)
  if (!f) throw new Error('missing')
  const all = readLS<ResponseRecord>(LS_RESPONSES)

  if (f.allow_edit ?? true) {
    const i = all
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.form_id === f.id)
      .sort((a, b) => b.r.submitted_at.localeCompare(a.r.submitted_at))[0]?.idx
    if (i !== undefined) {
      all[i] = {
        ...all[i],
        answers: input.answers,
        respondent: input.respondent || all[i].respondent,
        meta,
        updated_at: new Date().toISOString(),
        edits: (all[i].edits ?? 0) + 1,
      }
      writeLS(LS_RESPONSES, all)
      return 'updated'
    }
  }

  all.push({
    id: uid(),
    form_id: f.id,
    submitted_at: new Date().toISOString(),
    updated_at: null,
    edits: 0,
    respondent: input.respondent,
    answers: input.answers,
    meta,
  })
  writeLS(LS_RESPONSES, all)
  return 'created'
}

/* ───────────────────────── seed de demonstração ───────────────────────── */

export function hasLocalData(): boolean {
  return readLS<FormRecord>(LS_FORMS).length > 0
}

export async function seedDemo(): Promise<void> {
  if (backend !== 'local' || hasLocalData()) return
  const now = new Date()
  const iso = (d: number) => new Date(now.getTime() - d * 86400000).toISOString()
  const q = (
    position: number,
    type: any,
    label: string,
    extra: Partial<import('./types').Question> = {},
  ): import('./types').Question => ({
    id: uid(),
    position,
    section: null,
    type,
    label,
    description: null,
    placeholder: null,
    required: true,
    options: [],
    ...extra,
  })

  const demo: FormRecord = {
    id: uid(),
    slug: 'brisa-cafe-briefing',
    title: 'Briefing de Identidade Visual',
    description: 'Levantamento inicial para a nova marca.',
    client_name: 'Brisa Café',
    intro: 'Leva uns 6 minutos. Pode salvar e voltar depois — as respostas ficam no seu navegador.',
    outro: 'Recebido! Voltamos em até 2 dias úteis com a primeira rodada.',
    password: 'brisa2026',
    status: 'published',
    allow_edit: true,
    theme: { accent: '#d97706', surface: 'paper', flow: 'steps', logo: null, cover: null },
    created_at: iso(9),
    updated_at: iso(2),
    questions: [
      q(1, 'text', 'Qual o nome oficial da empresa?', { section: 'A marca' }),
      q(2, 'textarea', 'Descreva o negócio em 3 frases.', { section: 'A marca' }),
      q(3, 'checkbox', 'Quais palavras traduzem a marca?', {
        section: 'A marca',
        options: ['Artesanal', 'Sofisticada', 'Acolhedora', 'Moderna', 'Popular', 'Sustentável'],
      }),
      q(4, 'radio', 'Já existe logo?', { section: 'Situação atual', options: ['Sim', 'Não', 'Existe, mas queremos trocar'] }),
      q(5, 'url', 'Link de referência que vocês admiram', { section: 'Situação atual', required: false }),
      q(6, 'scale', 'Quão ousada a marca pode ser?', { section: 'Direção' }),
      q(7, 'date', 'Prazo desejado de entrega', { section: 'Direção' }),
      q(8, 'email', 'E-mail para retorno', { section: 'Contato' }),
    ],
  }

  const demo2: FormRecord = {
    id: uid(),
    slug: 'norte-logistica-onboarding',
    title: 'Onboarding — Dados do Cliente',
    description: 'Cadastro e documentos para abertura de conta.',
    client_name: 'Norte Logística',
    intro: null,
    outro: null,
    password: null,
    status: 'draft',
    allow_edit: true,
    theme: { accent: '#0891b2', surface: 'ink', flow: 'single', logo: null, cover: null },
    created_at: iso(3),
    updated_at: iso(1),
    questions: [
      q(1, 'text', 'Razão social'),
      q(2, 'text', 'CNPJ'),
      q(3, 'phone', 'Telefone comercial'),
      q(4, 'select', 'Regime tributário', { options: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'] }),
      q(5, 'yesno', 'Já opera com carga refrigerada?'),
    ],
  }

  writeLS(LS_FORMS, [demo, demo2])

  const answers: AnswerValue[] = demo.questions.slice(0, 5).map((qq) => ({
    question_id: qq.id,
    label: qq.label,
    type: qq.type,
    value:
      qq.type === 'checkbox'
        ? ['Artesanal', 'Acolhedora']
        : qq.type === 'radio'
          ? 'Existe, mas queremos trocar'
          : qq.type === 'url'
            ? 'https://exemplo.com'
            : 'Brisa Café Torrefação Artesanal',
  }))
  writeLS<ResponseRecord>(LS_RESPONSES, [
    {
      id: uid(),
      form_id: demo.id,
      submitted_at: iso(1),
      updated_at: null,
      edits: 0,
      respondent: 'marina@brisacafe.com.br',
      answers,
      meta: {},
    },
  ])
}

export function wipeLocal() {
  localStorage.removeItem(LS_FORMS)
  localStorage.removeItem(LS_RESPONSES)
}
