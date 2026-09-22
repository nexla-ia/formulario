export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'yesno'
  | 'rating'
  | 'scale'

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string; needsOptions: boolean }[] = [
  { value: 'text', label: 'Texto curto', hint: 'uma linha', needsOptions: false },
  { value: 'textarea', label: 'Texto longo', hint: 'parágrafo', needsOptions: false },
  { value: 'number', label: 'Número', hint: 'só dígitos', needsOptions: false },
  { value: 'email', label: 'E-mail', hint: 'validado', needsOptions: false },
  { value: 'phone', label: 'Telefone', hint: '(00) 00000-0000', needsOptions: false },
  { value: 'url', label: 'Link', hint: 'https://', needsOptions: false },
  { value: 'date', label: 'Data', hint: 'calendário', needsOptions: false },
  { value: 'select', label: 'Lista suspensa', hint: 'escolhe 1', needsOptions: true },
  { value: 'radio', label: 'Escolha única', hint: 'botões', needsOptions: true },
  { value: 'checkbox', label: 'Múltipla escolha', hint: 'escolhe várias', needsOptions: true },
  { value: 'yesno', label: 'Sim / Não', hint: 'binário', needsOptions: false },
  { value: 'rating', label: 'Estrelas', hint: '1 a 5', needsOptions: false },
  { value: 'scale', label: 'Escala 0–10', hint: 'NPS', needsOptions: false },
]

export const TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label]),
) as Record<QuestionType, string>

export interface Question {
  id: string
  form_id?: string
  position: number
  section: string | null
  type: QuestionType
  label: string
  description: string | null
  placeholder: string | null
  required: boolean
  options: string[]
}

export type FormStatus = 'draft' | 'published' | 'closed'

export interface FormTheme {
  accent: string
  /** 'paper' = claro | 'ink' = escuro (nomes mantidos por compatibilidade com o que já está no banco) */
  surface: 'paper' | 'ink'
  /**
   * Como o cliente preenche:
   *  • 'cards'  — todas as perguntas numa tela, responde clicando (padrão)
   *  • 'steps'  — uma pergunta por tela
   *  • 'single' — todos os campos abertos de uma vez
   */
  flow: 'cards' | 'steps' | 'single'
  /** logo da equipe, como data URL — aparece no topo do formulário do cliente */
  logo: string | null
  /** cor de fundo que a própria logo traz — a interface encosta ela nisso */
  logoBg?: string | null
  cover: string | null
}

export const DEFAULT_THEME: FormTheme = {
  accent: '#5646f5',
  surface: 'paper',
  flow: 'single',
  logo: null,
  logoBg: null,
  cover: null,
}

export interface FormRecord {
  id: string
  slug: string
  title: string
  description: string | null
  client_name: string | null
  intro: string | null
  outro: string | null
  password: string | null
  status: FormStatus
  /** cliente pode reabrir com a senha e corrigir o que enviou */
  allow_edit: boolean
  theme: FormTheme
  created_at: string
  updated_at: string
  questions: Question[]
  /** preenchido por listForms() */
  response_count?: number
}

export interface AnswerValue {
  question_id: string
  label: string
  type: QuestionType
  value: string | number | string[] | boolean | null
}

export interface ResponseRecord {
  id: string
  form_id: string
  submitted_at: string
  /** última vez que o cliente corrigiu (null = nunca editou) */
  updated_at?: string | null
  /** quantas vezes o cliente reabriu e salvou */
  edits?: number
  respondent: string | null
  answers: AnswerValue[]
  meta: Record<string, unknown>
}

export interface DraftForm {
  title: string
  client_name: string
  description: string
  slug: string
  password: string
  intro: string
  outro: string
  status: FormStatus
  allow_edit: boolean
  theme: FormTheme
  questions: Question[]
}
