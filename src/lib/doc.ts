/**
 * Leitura de documentos (.docx, .txt, .md, .rtf).
 *
 * O .docx é um zip com XML dentro. Em vez de puxar uma biblioteca pesada
 * de conversão, a gente descompacta com fflate e lê o XML direto.
 *
 * O que o Word esconde e que importa aqui:
 *
 *  • Lista numerada não traz o número no texto. O parágrafo diz só
 *    "Qual o nome da empresa?" e o "1." é desenhado pelo Word a partir de
 *    `numbering.xml`. Sem ler esse arquivo, uma lista de perguntas
 *    numeradas fica indistinguível de uma lista de alternativas — e as
 *    perguntas viram opções da primeira.
 *
 *  • O nível da lista separa pergunta de alternativa: nível 0 é a
 *    pergunta, nível 1 em diante é o que está indentado embaixo dela.
 *
 *  • Modelo de documento costuma embrulhar o conteúdo em `w:sdt`
 *    (controle de conteúdo) e caixas de texto em `w:txbxContent`. Quem lê
 *    só os filhos diretos do corpo perde tudo isso.
 */

export interface DocBlock {
  text: string
  /** parágrafo com estilo de título (Heading/Título) */
  heading: boolean
  /** item de lista com marcador redondo — candidato a alternativa */
  bullet: boolean
  /** item de lista numerada (1., a., i.) — quase sempre é pergunta */
  numbered: boolean
  /** nível da lista: 0 é o primeiro, 1+ está indentado embaixo */
  level: number
  /** o parágrafo inteiro em negrito */
  bold: boolean
  /** tamanho da fonte em meio-pontos (24 = 12pt); null = tamanho padrão */
  size: number | null
}

export interface DocContent {
  blocks: DocBlock[]
  /** cada tabela vira uma matriz linha × coluna */
  tables: string[][][]
}

const DOCX_MAIN = 'word/document.xml'
const DOCX_NUMBERING = 'word/numbering.xml'

/** numId → (nível → formato da numeração), lido de numbering.xml */
type NumFormats = Map<string, Map<number, string>>

export async function readDocx(file: File): Promise<DocContent> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const bytes = new Uint8Array(await file.arrayBuffer())

  let xml: string
  let numberingXml: string | null = null
  try {
    const entries = unzipSync(bytes, {
      filter: (f) => f.name === DOCX_MAIN || f.name === DOCX_NUMBERING,
    })
    const main = entries[DOCX_MAIN]
    if (!main) throw new Error('sem document.xml')
    xml = strFromU8(main)
    const num = entries[DOCX_NUMBERING]
    if (num) numberingXml = strFromU8(num)
  } catch {
    throw new Error(
      'Não consegui abrir esse .docx. Se for um .doc antigo, salve como .docx e tente de novo.',
    )
  }

  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.getElementsByTagName('parsererror').length) {
    throw new Error('O conteúdo desse documento veio corrompido.')
  }

  const formats = numberingXml ? readNumbering(numberingXml) : new Map()
  const body = dom.getElementsByTagName('w:body')[0] ?? dom.documentElement
  const blocks: DocBlock[] = []
  const tables: string[][][] = []

  walk(body, blocks, tables, formats)
  return { blocks, tables }
}

/**
 * Percorre o corpo na ordem, entrando em `w:sdt` e caixas de texto.
 * Uma tabela é lida como tabela e seus parágrafos não entram na lista de
 * blocos, senão a mesma pergunta apareceria duas vezes.
 */
function walk(node: Element, blocks: DocBlock[], tables: string[][][], formats: NumFormats) {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName
    if (tag === 'w:p') {
      const block = paragraph(child, formats)
      if (block) blocks.push(block)
    } else if (tag === 'w:tbl') {
      const grid = table(child)
      if (grid.length) tables.push(grid)
    } else if (tag === 'w:sdt' || tag === 'w:sdtContent' || tag === 'w:txbxContent') {
      walk(child, blocks, tables, formats)
    } else if (tag === 'w:r' || tag === 'mc:AlternateContent' || tag === 'mc:Choice') {
      // caixa de texto mora dentro de um run, embrulhada em AlternateContent
      walk(child, blocks, tables, formats)
    }
  }
}

/**
 * Lê numbering.xml e devolve, para cada numId, o formato de cada nível.
 * O caminho é numId → abstractNumId → abstractNum → lvl → numFmt.
 */
function readNumbering(xml: string): NumFormats {
  const out: NumFormats = new Map()
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    if (dom.getElementsByTagName('parsererror').length) return out

    // abstractNumId → (nível → formato)
    const abstracts = new Map<string, Map<number, string>>()
    for (const abs of Array.from(dom.getElementsByTagName('w:abstractNum'))) {
      const id = abs.getAttribute('w:abstractNumId')
      if (!id) continue
      const levels = new Map<number, string>()
      for (const lvl of Array.from(abs.getElementsByTagName('w:lvl'))) {
        const ilvl = Number(lvl.getAttribute('w:ilvl') ?? '0')
        const fmt = lvl.getElementsByTagName('w:numFmt')[0]?.getAttribute('w:val')
        if (fmt) levels.set(ilvl, fmt)
      }
      abstracts.set(id, levels)
    }

    for (const num of Array.from(dom.getElementsByTagName('w:num'))) {
      const numId = num.getAttribute('w:numId')
      const absId = num.getElementsByTagName('w:abstractNumId')[0]?.getAttribute('w:val')
      if (!numId || !absId) continue
      const levels = abstracts.get(absId)
      if (levels) out.set(numId, levels)
    }
  } catch {
    /* documento sem numeração utilizável — segue sem */
  }
  return out
}

/**
 * Junta o texto dos runs. Tabulação vira espaço (muita ficha usa tab
 * para abrir a linha da resposta) e a quebra manual também, porque para
 * a leitura de perguntas cada parágrafo é uma unidade só.
 */
function textOf(p: Element): string {
  let out = ''
  for (const node of Array.from(p.getElementsByTagName('*'))) {
    const tag = node.tagName
    if (tag === 'w:t') out += node.textContent ?? ''
    else if (tag === 'w:tab' || tag === 'w:br' || tag === 'w:cr') out += ' '
  }
  return out
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function paragraph(p: Element, formats: NumFormats): DocBlock | null {
  const text = textOf(p)
  if (!text) return null

  const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? ''
  const heading = /^(heading|titulo|título|ttulo|ttulo)/i.test(style)

  const numPr = p.getElementsByTagName('w:numPr')[0]
  let bullet = false
  let numbered = false
  let level = 0
  if (numPr && !heading) {
    level = Number(numPr.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') ?? '0') || 0
    const numId = numPr.getElementsByTagName('w:numId')[0]?.getAttribute('w:val') ?? ''
    const fmt = formats.get(numId)?.get(level)
    // Sem numbering.xml legível, o padrão antigo (tratar como marcador)
    // é o mais seguro: o texto ainda pode trazer "1." escrito à mão.
    if (fmt === 'bullet' || fmt === 'none') bullet = true
    else if (fmt) numbered = true
    else bullet = true
  }

  return { text, heading, bullet, numbered, level, bold: isBold(p), size: sizeOf(p) }
}

/**
 * Tamanho da fonte do parágrafo, em meio-pontos. É o sinal mais confiável
 * para achar seção: quem escreve ficha no Word raramente usa estilo de
 * título, mas quase sempre aumenta a fonte do nome do bloco.
 */
function sizeOf(p: Element): number | null {
  const daVez =
    p.getElementsByTagName('w:pPr')[0]?.getElementsByTagName('w:sz')[0] ??
    p.getElementsByTagName('w:sz')[0]
  const val = Number(daVez?.getAttribute('w:val') ?? '')
  return Number.isFinite(val) && val > 0 ? val : null
}

/** Negrito de verdade: todos os runs com texto precisam estar em negrito. */
function isBold(p: Element): boolean {
  const runs = Array.from(p.getElementsByTagName('w:r')).filter(
    (r) => (r.getElementsByTagName('w:t')[0]?.textContent ?? '').trim().length > 0,
  )
  if (!runs.length) return false
  return runs.every((r) => {
    const b = r.getElementsByTagName('w:b')[0]
    if (!b) return false
    const val = b.getAttribute('w:val')
    return val === null || val === '1' || val === 'true' || val === 'on'
  })
}

function table(tbl: Element): string[][] {
  const rows: string[][] = []
  for (const tr of Array.from(tbl.children)) {
    if (tr.tagName !== 'w:tr') continue
    const cells: string[] = []
    for (const tc of Array.from(tr.children)) {
      if (tc.tagName !== 'w:tc') continue
      const parts: string[] = []
      for (const p of Array.from(tc.children)) {
        if (p.tagName !== 'w:p') continue
        const t = textOf(p)
        if (t) parts.push(t)
      }
      cells.push(parts.join('\n'))
    }
    if (cells.some((c) => c.trim())) rows.push(cells)
  }
  return rows
}

/* ── RTF: tira a marcação e devolve o texto ─────────────── */

export function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) & 0xffff))
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
