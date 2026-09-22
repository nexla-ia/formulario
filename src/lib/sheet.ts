/**
 * Leitura da planilha de perguntas (.xlsx / .xls / .csv / .tsv).
 * Tolerante: reconhece cabeçalhos em PT e EN, em qualquer ordem, com
 * ou sem acento, e ainda funciona em planilha sem cabeçalho nenhum.
 */
import type * as XLSXNS from 'xlsx'
import type { Question, QuestionType } from './types'
import { answerText } from './utils'

/** xlsx pesa ~900 kB: só entra no bundle quando alguém realmente lê ou
 *  gera uma planilha. A página do cliente nunca carrega isso. */
let xlsxPromise: Promise<typeof XLSXNS> | null = null
const loadXLSX = () => (xlsxPromise ??= import('xlsx'))

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/** minúscula, sem acento, sem pontuação */
function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type Col = 'label' | 'type' | 'required' | 'options' | 'section' | 'description' | 'placeholder'

const HEADER_ALIASES: Record<Col, string[]> = {
  label: ['pergunta', 'perguntas', 'questao', 'questoes', 'titulo', 'label', 'question', 'campo', 'item', 'enunciado'],
  type: ['tipo', 'type', 'formato', 'tipo de campo', 'tipo resposta', 'tipo de resposta'],
  required: ['obrigatoria', 'obrigatorio', 'obrigatoriedade', 'required', 'req', 'necessaria', 'necessario'],
  options: ['opcoes', 'opcao', 'alternativas', 'options', 'choices', 'valores', 'escolhas', 'lista'],
  section: ['secao', 'sessao', 'grupo', 'categoria', 'bloco', 'section', 'group', 'etapa', 'modulo'],
  description: ['descricao', 'ajuda', 'instrucao', 'instrucoes', 'help', 'hint', 'subtitulo', 'detalhe', 'observacao'],
  placeholder: ['placeholder', 'exemplo', 'dica', 'ex'],
}

const TYPE_ALIASES: [QuestionType, string[]][] = [
  ['textarea', ['texto longo', 'longo', 'paragrafo', 'textarea', 'long text', 'dissertativa', 'texto grande', 'multilinha']],
  ['text', ['texto curto', 'texto', 'curto', 'text', 'short text', 'string', 'livre', 'aberta']],
  ['number', ['numero', 'number', 'int', 'inteiro', 'decimal', 'valor', 'quantidade', 'qtd']],
  ['email', ['email', 'e mail', 'mail']],
  ['phone', ['telefone', 'fone', 'celular', 'phone', 'whatsapp', 'tel']],
  ['url', ['url', 'link', 'site', 'website', 'endereco web']],
  ['date', ['data', 'date', 'dia', 'prazo', 'calendario']],
  ['select', ['lista suspensa', 'select', 'dropdown', 'combo', 'suspensa', 'menu']],
  ['radio', ['escolha unica', 'unica escolha', 'radio', 'unica', 'opcao unica', 'single', 'uma opcao']],
  ['checkbox', ['multipla escolha', 'multipla', 'checkbox', 'varias', 'multi', 'multiselect', 'caixas']],
  ['yesno', ['sim nao', 'sim ou nao', 'boolean', 'bool', 'yesno', 'yes no', 'binario', 'v f']],
  ['rating', ['estrelas', 'rating', 'nota', 'avaliacao', 'estrela', 'stars']],
  ['scale', ['escala', 'nps', 'scale', '0 10', '0 a 10', 'slider', 'nota 0 10']],
]

function matchType(raw: unknown): QuestionType | null {
  const n = norm(raw)
  if (!n) return null
  for (const [type, aliases] of TYPE_ALIASES) if (aliases.includes(n)) return type
  for (const [type, aliases] of TYPE_ALIASES) if (aliases.some((a) => n.includes(a))) return type
  return null
}

function matchCol(raw: unknown): Col | null {
  const n = norm(raw)
  if (!n) return null
  for (const key of Object.keys(HEADER_ALIASES) as Col[]) {
    if (HEADER_ALIASES[key].includes(n)) return key
  }
  for (const key of Object.keys(HEADER_ALIASES) as Col[]) {
    if (HEADER_ALIASES[key].some((a) => n.startsWith(a))) return key
  }
  return null
}

function truthy(raw: unknown): boolean {
  const n = norm(raw)
  return ['sim', 's', 'x', 'true', 'yes', 'y', '1', 'obrigatoria', 'obrigatorio', 'sempre'].includes(n)
}

function splitOptions(raw: unknown): string[] {
  const s = String(raw ?? '').trim()
  if (!s) return []
  const sep = s.includes('|') ? '|' : s.includes('\n') ? '\n' : s.includes(';') ? ';' : ','
  return s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * Descobre o tipo de resposta. Usa o que veio escrito na coluna "Tipo";
 * se estiver vazio, deduz pelas opções e pelo texto da pergunta.
 */
export function inferType(label: string, options: string[], rawType?: unknown): QuestionType {
  const declared = matchType(rawType)
  if (declared) return declared
  if (options.length >= 2) return options.length > 5 ? 'select' : 'radio'
  if (/e-?mail/i.test(label)) return 'email'
  if (/telefone|celular|whats/i.test(label)) return 'phone'
  if (/\bdata\b|prazo|quando|dia \b/i.test(label)) return 'date'
  if (/link|site|url|instagram|portf[oó]lio/i.test(label)) return 'url'
  if (/quantos|quantas|quantidade|n[uú]mero de|valor|or[çc]amento|cnpj|cpf/i.test(label))
    return /cnpj|cpf/i.test(label) ? 'text' : 'number'
  if (/de 0 a 10|nota de|nps|escala/i.test(label)) return 'scale'
  if (/quantas estrelas|avalie|satisfa[çc][ãa]o/i.test(label)) return 'rating'
  if (/^(voc|vcs|vocês|tem|possui|j[aá] |pode|podemos|aceita|deseja)/i.test(label.trim()))
    return 'yesno'
  if (/descreva|conte|explique|detalhe|objetivo|fale sobre|comente|resuma/i.test(label))
    return 'textarea'
  return 'text'
}

export type ParseKind = 'sheet' | 'doc' | 'text'

export interface ParseReport {
  questions: Question[]
  /** de onde as perguntas vieram — muda o texto do resumo na tela */
  kind: ParseKind
  /** nome da aba (planilha) ou do arquivo/origem */
  sheetName: string
  sheets: string[]
  totalRows: number
  skipped: number
  headerFound: boolean
  mapped: Partial<Record<Col, string>>
  warnings: string[]
}

/**
 * Lê a planilha. Sem aba escolhida, procura sozinho a que tem as
 * perguntas: a primeira aba costuma ser capa ou instrução, e pegar a
 * primeira às cegas trazia "Como preencher" como pergunta.
 */
export async function parseWorkbook(file: File, sheetIndex?: number): Promise<ParseReport> {
  const [XLSX, buf] = await Promise.all([loadXLSX(), file.arrayBuffer()])
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheets = wb.SheetNames
  if (!sheets.length) throw new Error('Planilha vazia.')

  const ler = (nome: string) =>
    XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    })

  if (sheetIndex !== undefined) {
    const nome = sheets[Math.min(sheetIndex, sheets.length - 1)]
    return rowsToQuestions(ler(nome), { sheetName: nome, sheets })
  }

  let melhor: ParseReport | null = null
  let erro: unknown = null
  for (const nome of sheets) {
    try {
      const r = rowsToQuestions(ler(nome), { sheetName: nome, sheets })
      if (!melhor || r.questions.length > melhor.questions.length) melhor = r
    } catch (e) {
      erro = erro ?? e
    }
  }
  if (!melhor) throw erro ?? new Error('Planilha vazia.')
  return melhor
}

export function rowsToQuestions(
  grid: unknown[][],
  ctx: { sheetName: string; sheets: string[]; labelOnly?: boolean },
): ParseReport {
  const warnings: string[] = []
  const clean = grid.filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
  if (!clean.length) throw new Error('Nenhuma linha preenchida na planilha.')

  // 1. Onde está o cabeçalho? Procura nas 6 primeiras linhas.
  let headerRow = -1
  let map: Partial<Record<Col, number>> = {}
  for (let r = 0; r < Math.min(6, clean.length); r++) {
    const candidate: Partial<Record<Col, number>> = {}
    clean[r].forEach((cell, i) => {
      const col = matchCol(cell)
      if (col && candidate[col] === undefined) candidate[col] = i
    })
    if (candidate.label !== undefined || Object.keys(candidate).length >= 2) {
      headerRow = r
      map = candidate
      break
    }
  }

  const headerFound = headerRow >= 0
  if (!headerFound) {
    const largura = Math.max(...clean.map((r) => r.filter((c) => String(c ?? '').trim()).length))
    if (ctx.labelOnly || largura <= 1) {
      // Só há uma coluna de verdade: não há ordem de colunas para avisar.
      map = { label: 0 }
    } else {
      // Sem cabeçalho: assume ordem pergunta | tipo | obrigatória | opções
      map = { label: 0, type: 1, required: 2, options: 3 }
      warnings.push('Cabeçalho não reconhecido — usei a ordem das colunas (pergunta, tipo, obrigatória, opções).')
    }
  }
  if (map.label === undefined) {
    map.label = 0
    warnings.push('Coluna de pergunta não identificada — usei a primeira coluna.')
  }

  const body = headerFound ? clean.slice(headerRow + 1) : clean
  const cell = (row: unknown[], col?: number) => (col === undefined ? '' : String(row[col] ?? '').trim())

  const questions: Question[] = []
  let skipped = 0
  let currentSection: string | null = null

  for (const row of body) {
    let label = cell(row, map.label)
    const sectionCell = cell(row, map.section)

    // linha que só traz seção → vira o cabeçalho dos próximos itens
    if (!label && sectionCell) {
      currentSection = sectionCell
      continue
    }
    // "## Bloco" ou "# Bloco" na coluna de pergunta
    if (/^#{1,3}\s+/.test(label)) {
      currentSection = label.replace(/^#{1,3}\s+/, '').trim()
      continue
    }
    if (!label) {
      skipped++
      continue
    }

    if (sectionCell) currentSection = sectionCell

    const options = splitOptions(cell(row, map.options))
    let type = inferType(label, options, cell(row, map.type))
    if ((type === 'select' || type === 'radio' || type === 'checkbox') && options.length === 0) {
      warnings.push(`"${label.slice(0, 40)}" é ${type} mas veio sem opções — virou texto curto.`)
      type = 'text'
    }

    // Sem coluna de obrigatoriedade, o padrão é obrigatória.
    // "*" no fim força obrigatória; "(opcional)" força opcional.
    let required = map.required !== undefined ? truthy(cell(row, map.required)) : true
    if (/\*\s*$/.test(label)) {
      required = true
      label = label.replace(/\*+\s*$/, '').trim()
    }
    if (/\(opcional\)\s*$/i.test(label)) {
      required = false
      label = label.replace(/\(opcional\)\s*$/i, '').trim()
    }

    questions.push({
      id: uid(),
      position: questions.length + 1,
      section: currentSection,
      type,
      label,
      description: cell(row, map.description) || null,
      placeholder: cell(row, map.placeholder) || null,
      required,
      options,
    })
  }

  if (!questions.length) throw new Error('Não achei nenhuma pergunta nessa aba.')

  const mapped: Partial<Record<Col, string>> = {}
  for (const k of Object.keys(map) as Col[]) {
    const idx = map[k]
    if (idx === undefined) continue
    mapped[k] = headerFound ? String(clean[headerRow][idx] ?? `col ${idx + 1}`) : `coluna ${idx + 1}`
  }

  return {
    questions,
    kind: 'sheet',
    sheetName: ctx.sheetName,
    sheets: ctx.sheets,
    totalRows: body.length,
    skipped,
    headerFound,
    mapped,
    warnings,
  }
}

/* ── Planilha-modelo para baixar ─────────────────────────────── */

const TEMPLATE_ROWS = [
  ['Seção', 'Pergunta', 'Tipo', 'Obrigatória', 'Opções', 'Ajuda'],
  ['Sobre a empresa', 'Qual o nome oficial da empresa?', 'texto curto', 'sim', '', 'Como aparece no contrato'],
  ['Sobre a empresa', 'Descreva o negócio em poucas linhas', 'texto longo', 'sim', '', ''],
  ['Sobre a empresa', 'Quantos funcionários hoje?', 'número', 'não', '', ''],
  ['Projeto', 'Qual o objetivo principal?', 'escolha única', 'sim', 'Vender mais|Reduzir custo|Lançar produto|Outro', ''],
  ['Projeto', 'Quais canais vocês já usam?', 'múltipla escolha', 'não', 'Instagram|WhatsApp|Google|Loja física|E-mail', ''],
  ['Projeto', 'Prazo desejado', 'data', 'sim', '', ''],
  ['Projeto', 'Quão urgente é?', 'escala', 'não', '', '0 = tranquilo, 10 = ontem'],
  ['Contato', 'E-mail do responsável', 'e-mail', 'sim', '', ''],
  ['Contato', 'Telefone / WhatsApp', 'telefone', 'não', '', ''],
  ['Contato', 'Podemos divulgar o case?', 'sim/não', 'não', '', ''],
]

export async function downloadTemplate() {
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS)
  ws['!cols'] = [{ wch: 18 }, { wch: 44 }, { wch: 18 }, { wch: 12 }, { wch: 46 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Perguntas')

  const ref = XLSX.utils.aoa_to_sheet([
    ['Tipos aceitos na coluna "Tipo"'],
    ['texto curto', 'uma linha'],
    ['texto longo', 'parágrafo'],
    ['número', 'só dígitos'],
    ['e-mail', 'valida o formato'],
    ['telefone', 'máscara (00) 00000-0000'],
    ['link', 'valida https://'],
    ['data', 'seletor de data'],
    ['lista suspensa', 'precisa da coluna Opções'],
    ['escolha única', 'precisa da coluna Opções'],
    ['múltipla escolha', 'precisa da coluna Opções'],
    ['sim/não', 'dois botões'],
    ['estrelas', '1 a 5'],
    ['escala', '0 a 10'],
    [],
    ['Dicas'],
    ['Separe opções com | (barra vertical)'],
    ['Deixe "Tipo" em branco que o sistema adivinha pelo texto da pergunta'],
    ['A coluna "Seção" agrupa perguntas em blocos'],
  ])
  ref['!cols'] = [{ wch: 26 }, { wch: 44 }]
  XLSX.utils.book_append_sheet(wb, ref, 'Como preencher')

  XLSX.writeFile(wb, 'modelo-perguntas.xlsx')
}

/* ── Exportar respostas ──────────────────────────────────────── */

export async function exportResponses(
  formTitle: string,
  questions: Question[],
  responses: import('./types').ResponseRecord[],
) {
  const XLSX = await loadXLSX()
  const header = ['Enviado em', 'Identificação', ...questions.map((q) => q.label)]
  const rows = responses.map((r) => {
    const byId = new Map(r.answers.map((a) => [a.question_id, a]))
    const byLabel = new Map(r.answers.map((a) => [a.label, a]))
    return [
      new Date(r.submitted_at).toLocaleString('pt-BR'),
      r.respondent ?? '',
      ...questions.map((q) => answerText(q.type, (byId.get(q.id) ?? byLabel.get(q.label))?.value)),
    ]
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = header.map((h) => ({ wch: Math.min(48, Math.max(14, h.length + 4)) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Respostas')
  const safe = formTitle.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'respostas'
  XLSX.writeFile(wb, `${safe} — respostas.xlsx`)
}

/* ══════════════════════════════════════════════════════════════
   Documentos e texto solto
   ══════════════════════════════════════════════════════════════ */

export interface TextLine {
  text: string
  /** parágrafo com estilo de título no Word */
  heading?: boolean
  /** item de lista com marcador redondo no Word — candidato a alternativa */
  bullet?: boolean
  /** item de lista numerada no Word — o número não vem no texto */
  numbered?: boolean
  /** nível da lista: 0 é o primeiro, 1+ está indentado embaixo */
  level?: number
  /** parágrafo inteiro em negrito */
  bold?: boolean
}

/** Marcadores que costumam indicar uma ALTERNATIVA, não uma pergunta. */
const OPTION_MARK = /^\s*(?:[-*•▪◦·–—]|\(\s*\)|\[\s*\]|☐|□|[a-zA-Z]\s*[).])\s+/
/** Numeração de lista — quase sempre é a própria pergunta. */
const NUMBER_MARK = /^\s*\d+\s*[).\-–]\s+/
const MAX_OPTIONS = 14

const stripMark = (t: string) => t.replace(OPTION_MARK, '').replace(NUMBER_MARK, '').trim()

/** Tira "(texto longo)", "(opcional)" e "*" do fim da pergunta. */
function stripHints(raw: string): { label: string; hint: string | null; required: boolean | null } {
  let label = raw.trim()
  let hint: string | null = null
  let required: boolean | null = null

  if (/\*+\s*$/.test(label)) {
    required = true
    label = label.replace(/\*+\s*$/, '').trim()
  }

  const paren = /[([]([^)\]]{2,32})[)\]]\s*$/.exec(label)
  if (paren) {
    const inside = paren[1].trim()
    if (/^opcional$/i.test(inside)) {
      required = false
      label = label.slice(0, paren.index).trim()
    } else if (/^obrigat[óo]ri[ao]$/i.test(inside)) {
      required = true
      label = label.slice(0, paren.index).trim()
    } else if (matchType(inside)) {
      hint = inside
      label = label.slice(0, paren.index).trim()
    }
  }

  return { label: label.replace(/[:：]\s*$/, '').trim(), hint, required }
}

function looksLikeSection(
  text: string,
  heading?: boolean,
  bold?: boolean,
  emLista?: boolean,
): string | null {
  if (heading) return text.replace(/[:：]\s*$/, '').trim()
  /*
    Daqui para baixo é palpite. Item de lista não entra: numa lista de
    perguntas, "CNPJ" é pergunta — só está em maiúscula porque é sigla.
    Antes essa linha virava seção e engolia a pergunta.
  */
  if (emLista) return null
  // Muita gente do Word não usa estilo de título: só deixa a linha da
  // seção em negrito.
  if (bold && text.length <= 64 && !/[?？]/.test(text)) {
    return text.replace(/[:：]\s*$/, '').trim()
  }
  const md = /^#{1,6}\s+(.*)$/.exec(text)
  if (md) return md[1].trim()
  if (text.includes('?')) return null
  if (text.length > 64) return null
  // "Sobre a empresa:" — termina em dois-pontos e não parece pergunta
  if (/[:：]\s*$/.test(text) && text.length >= 3) return text.replace(/[:：]\s*$/, '').trim()
  // "SOBRE A EMPRESA" — tudo em maiúscula
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length >= 3 && text === text.toUpperCase() && /[A-ZÀ-Ü]/.test(text)) {
    return text.trim()
  }
  return null
}

/** Transforma uma lista de linhas (documento ou texto colado) em perguntas. */
export function linesToQuestions(
  lines: TextLine[],
  sourceName: string,
  kind: ParseKind = 'text',
): ParseReport {
  const warnings: string[] = []
  const questions: Question[] = []
  /** guarda o "(tipo)" escrito na pergunta ate a hora de aplicar */
  const hints = new Map<string, string>()
  let section: string | null = null
  let last = -1
  let skipped = 0
  let total = 0

  for (const line of lines) {
    const text = (line.text ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    total++

    const asSection = looksLikeSection(text, line.heading, line.bold, line.bullet || line.numbered)
    if (asSection) {
      section = asSection
      last = -1
      continue
    }

    const nivel = line.level ?? 0
    // Lista numerada do Word: o "1." é desenhado pelo Word e não chega no
    // texto. Isso é pergunta, nunca alternativa — tratar como marcador
    // fazia a segunda pergunta em diante virar opção da primeira.
    const listaNumerada = line.numbered === true && nivel === 0
    const marked = (OPTION_MARK.test(text) || line.bullet === true) && !listaNumerada
    const numbered = NUMBER_MARK.test(text) || listaNumerada
    const isQuestion = /[?？]\s*$/.test(text)
    const bare = stripMark(text)
    if (!bare) {
      skipped++
      continue
    }

    // Alternativa: linha marcada, curta, logo abaixo de uma pergunta.
    // Item indentado (nível 1+) é alternativa mesmo se for numerado —
    // é o "a) / b) / c)" embaixo da pergunta.
    const canBeOption =
      (marked || nivel > 0) &&
      !listaNumerada &&
      !isQuestion &&
      last >= 0 &&
      bare.length <= 90 &&
      questions[last].options.length < MAX_OPTIONS
    if (canBeOption) {
      questions[last].options.push(bare)
      continue
    }

    const { label, hint, required } = stripHints(bare)
    if (!label) {
      skipped++
      continue
    }

    questions.push({
      id: uid(),
      position: questions.length + 1,
      section,
      type: 'text',
      label,
      description: null,
      placeholder: null,
      required: required ?? true,
      options: [],
    })
    last = questions.length - 1
    if (hint) hints.set(questions[last].id, hint)
  }

  // Rede de segurança: uma pergunta só com um monte de alternativas
  // quase sempre é uma lista de perguntas com marcador.
  if (questions.length === 1 && questions[0].options.length >= 3) {
    const only = questions[0]
    const extra = only.options.map((label, i) => ({
      id: uid(),
      position: questions.length + i + 1,
      section: only.section,
      type: 'text' as QuestionType,
      label,
      description: null,
      placeholder: null,
      required: true,
      options: [] as string[],
    }))
    only.options = []
    questions.push(...extra)
    warnings.push('Interpretei os itens com marcador como perguntas, não como alternativas.')
  }

  // Fecha o tipo de cada pergunta agora que as alternativas estão no lugar.
  for (const q of questions) {
    const declared = hints.get(q.id)
    q.type = inferType(q.label, q.options, declared)
    if (q.options.length >= 2 && !matchType(declared)) {
      q.type = /\bquais\b|marque|selecione todas|mais de uma|v[áa]rias/i.test(q.label)
        ? 'checkbox'
        : q.options.length > 6
          ? 'select'
          : 'radio'
    }
    if (['select', 'radio', 'checkbox'].includes(q.type) && q.options.length === 0) q.type = 'text'
    hints.delete(q.id)
  }

  questions.forEach((q, i) => (q.position = i + 1))

  if (!questions.length) {
    throw new Error(
      'Não achei nenhuma pergunta aí. Escreva uma pergunta por linha — e as alternativas com "-" logo abaixo.',
    )
  }
  if (questions.length === 1) {
    warnings.push('Só encontrei uma pergunta. Confira se cada pergunta está numa linha própria.')
  }

  return {
    questions,
    kind,
    sheetName: sourceName,
    sheets: [],
    totalRows: total,
    skipped,
    headerFound: false,
    mapped: {},
    warnings,
  }
}

export function parseTextToQuestions(text: string, sourceName = 'texto colado'): ParseReport {
  const lines = text.split(/\r?\n/).map((t) => ({ text: t }))
  return linesToQuestions(lines, sourceName, 'text')
}

/* ── Porta de entrada única: descobre o formato e delega ── */

const SHEET_EXT = ['xlsx', 'xlsm', 'xls', 'csv', 'tsv', 'ods']
const TEXT_EXT = ['txt', 'md', 'markdown', 'rtf']

export const ACCEPTED_FILES = [
  '.xlsx', '.xls', '.xlsm', '.csv', '.tsv', '.ods',
  '.docx', '.txt', '.md', '.markdown', '.rtf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/rtf',
].join(',')

/**
 * Tabela do Word quase nunca é planilha de especificação. O padrão é
 * "Campo | espaço da resposta", às vezes já preenchido pelo cliente. Se a
 * segunda coluna não nomeia tipos de campo, ela é resposta — e a pergunta
 * está inteira na primeira coluna. Lida como planilha, essa segunda coluna
 * virava o "tipo" de cada pergunta e saía tudo errado.
 */
function narrowDocTable(grid: string[][]): { grid: string[][]; warning: string | null } {
  const width = Math.max(...grid.map((r) => r.length))
  if (width < 2) return { grid, warning: null }

  // Cabeçalho de planilha de verdade (Pergunta / Tipo / Opções)? Respeita.
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    const achados = (grid[r] ?? []).map((c) => matchCol(c)).filter(Boolean)
    if (achados.length >= 2) return { grid, warning: null }
  }

  // A segunda coluna nomeia tipos de campo na maioria das linhas?
  const segunda = grid.map((r) => String(r[1] ?? '').trim()).filter(Boolean)
  if (segunda.length && segunda.filter((v) => matchType(v)).length / segunda.length >= 0.6) {
    return { grid, warning: null }
  }

  return {
    grid: grid.map((r) => [r[0] ?? '']),
    warning: 'A tabela tinha coluna de resposta — usei só a primeira coluna como pergunta.',
  }
}

export async function parseAnyFile(file: File, sheetIndex?: number): Promise<ParseReport> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()

  if (SHEET_EXT.includes(ext)) return parseWorkbook(file, sheetIndex)

  if (ext === 'docx') {
    const { readDocx } = await import('./doc')
    const doc = await readDocx(file)

    /*
      Antes, qualquer tabela com duas linhas ganhava do documento inteiro e
      os parágrafos eram jogados fora — uma tabelinha de "Cliente / Data" no
      topo apagava as 30 perguntas escritas embaixo. Agora as duas leituras
      são feitas e vence a que encontra mais perguntas.
    */
    const candidatos: { report: ParseReport; aviso: string | null }[] = []

    if (doc.blocks.length) {
      try {
        candidatos.push({ report: linesToQuestions(doc.blocks, file.name, 'doc'), aviso: null })
      } catch {
        /* segue para as tabelas */
      }
    }

    for (const bruta of doc.tables) {
      if (bruta.length < 2) continue
      const { grid, warning } = narrowDocTable(bruta)
      try {
        candidatos.push({
          report: rowsToQuestions(grid, {
            sheetName: file.name,
            sheets: [],
            labelOnly: !!warning,
          }),
          aviso: warning ?? 'Li a tabela do documento como se fosse uma planilha.',
        })
      } catch {
        /* tabela sem nada aproveitável */
      }
    }

    const util = candidatos.filter((c) => c.report.questions.length > 0)
    if (!util.length) throw new Error('Esse documento está vazio.')

    const melhor = util.reduce((a, b) =>
      b.report.questions.length > a.report.questions.length ? b : a,
    )
    return {
      ...melhor.report,
      kind: 'doc',
      warnings: melhor.aviso
        ? [melhor.aviso, ...melhor.report.warnings]
        : melhor.report.warnings,
    }
  }

  if (TEXT_EXT.includes(ext)) {
    let text = await file.text()
    if (ext === 'rtf') {
      const { rtfToText } = await import('./doc')
      text = rtfToText(text)
    }
    return linesToQuestions(
      text.split(/\r?\n/).map((t) => ({ text: t })),
      file.name,
      'doc',
    )
  }

  if (ext === 'pdf') {
    throw new Error(
      'PDF ainda não dá. Salve como .docx, ou copie o texto e cole na aba "Colar texto".',
    )
  }
  if (ext === 'doc') {
    throw new Error('.doc antigo não dá. Abra no Word e salve como .docx.')
  }
  if (ext === 'pages' || ext === 'odt') {
    throw new Error(`Exporte esse arquivo como .docx ou .txt e tente de novo.`)
  }
  throw new Error(
    `Não sei ler arquivos .${ext || '?'}. Use planilha (.xlsx, .csv) ou documento (.docx, .txt).`,
  )
}
