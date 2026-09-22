import type { Question, QuestionType } from './types'

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

type Raw = [section: string, label: string, type: QuestionType, options?: string[], required?: boolean]

export interface Template {
  id: string
  name: string
  blurb: string
  accent: string
  rows: Raw[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'briefing',
    name: 'Briefing de marca',
    blurb: 'Levantamento inicial para identidade visual ou rebranding.',
    accent: '#7c3aed',
    rows: [
      ['A empresa', 'Qual o nome oficial da empresa?', 'text'],
      ['A empresa', 'Descreva o negócio em poucas linhas', 'textarea'],
      ['A empresa', 'Quem é o público que vocês querem atingir?', 'textarea'],
      ['A marca', 'Quais palavras traduzem a marca?', 'checkbox', ['Artesanal', 'Sofisticada', 'Acolhedora', 'Moderna', 'Popular', 'Sustentável', 'Técnica']],
      ['A marca', 'Já existe logo?', 'radio', ['Sim, e vamos manter', 'Sim, mas queremos trocar', 'Não existe']],
      ['A marca', 'Link de referência que vocês admiram', 'url', undefined, false],
      ['Direção', 'Quão ousada a marca pode ser?', 'scale'],
      ['Direção', 'Tem alguma cor que não pode aparecer?', 'text', undefined, false],
      ['Projeto', 'Prazo desejado de entrega', 'date'],
      ['Contato', 'E-mail do responsável', 'email'],
      ['Contato', 'Telefone / WhatsApp', 'phone', undefined, false],
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding de cliente',
    blurb: 'Cadastro e dados iniciais para abrir a conta.',
    accent: '#2563eb',
    rows: [
      ['Empresa', 'Razão social', 'text'],
      ['Empresa', 'Nome fantasia', 'text'],
      ['Empresa', 'CNPJ', 'text'],
      ['Empresa', 'Regime tributário', 'select', ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']],
      ['Endereço', 'CEP', 'text'],
      ['Endereço', 'Endereço completo', 'textarea'],
      ['Responsável', 'Nome do responsável', 'text'],
      ['Responsável', 'E-mail para nota fiscal', 'email'],
      ['Responsável', 'Telefone comercial', 'phone'],
      ['Responsável', 'Podemos mandar avisos por WhatsApp?', 'yesno', undefined, false],
    ],
  },
  {
    id: 'nps',
    name: 'Satisfação / NPS',
    blurb: 'Pesquisa curta para medir como o cliente avalia o serviço.',
    accent: '#0d9f6e',
    rows: [
      ['Avaliação', 'De 0 a 10, o quanto você recomendaria a gente?', 'scale'],
      ['Avaliação', 'Como avalia o atendimento?', 'rating'],
      ['Avaliação', 'O que mais pesou nessa nota?', 'textarea'],
      ['Avaliação', 'O prazo combinado foi cumprido?', 'yesno'],
      ['Melhorias', 'O que a gente poderia fazer melhor?', 'textarea', undefined, false],
      ['Melhorias', 'Podemos divulgar seu depoimento?', 'yesno', undefined, false],
      ['Contato', 'E-mail (opcional, se quiser retorno)', 'email', undefined, false],
    ],
  },
  {
    id: 'projeto',
    name: 'Escopo de projeto',
    blurb: 'Entender objetivo, prazo e orçamento antes da proposta.',
    accent: '#d97706',
    rows: [
      ['Projeto', 'Qual o objetivo principal do projeto?', 'radio', ['Vender mais', 'Reduzir custo', 'Lançar produto', 'Melhorar imagem', 'Outro']],
      ['Projeto', 'Descreva o que você imagina como resultado', 'textarea'],
      ['Projeto', 'Quais canais vocês já usam?', 'checkbox', ['Instagram', 'WhatsApp', 'Google', 'Loja física', 'E-mail', 'Indicação']],
      ['Projeto', 'Nível de urgência', 'scale', undefined, false],
      ['Projeto', 'Prazo desejado', 'date'],
      ['Orçamento', 'Faixa de investimento prevista', 'select', ['Até R$ 5 mil', 'R$ 5 a 15 mil', 'R$ 15 a 40 mil', 'Acima de R$ 40 mil', 'Ainda não sei']],
      ['Contato', 'Quem decide a contratação?', 'text'],
      ['Contato', 'E-mail do responsável', 'email'],
    ],
  },
]

export function templateQuestions(t: Template): Question[] {
  return t.rows.map(([section, label, type, options, required], i) => ({
    id: uid(),
    position: i + 1,
    section,
    type,
    label,
    description: null,
    placeholder: null,
    required: required ?? true,
    options: options ?? [],
  }))
}
