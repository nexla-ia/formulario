/**
 * Leitura de documentos (.docx, .txt, .md, .rtf).
 *
 * O .docx é um zip com um XML dentro. Em vez de puxar uma biblioteca
 * pesada de conversão, a gente descompacta com fflate e lê o XML direto:
 * pega os parágrafos, marca os que são título e os que são item de lista,
 * e devolve também as tabelas — muita gente escreve as perguntas numa
 * tabela do Word, e aí dá para tratar igual planilha.
 */

export interface DocBlock {
  text: string
  /** parágrafo com estilo de título (Heading/Título) */
  heading: boolean
  /** item de lista com marcador ou numeração */
  bullet: boolean
}

export interface DocContent {
  blocks: DocBlock[]
  /** cada tabela vira uma matriz linha × coluna */
  tables: string[][][]
}

const DOCX_MAIN = 'word/document.xml'

export async function readDocx(file: File): Promise<DocContent> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const bytes = new Uint8Array(await file.arrayBuffer())

  let xml: string
  try {
    const entries = unzipSync(bytes, { filter: (f) => f.name === DOCX_MAIN })
    const main = entries[DOCX_MAIN]
    if (!main) throw new Error('sem document.xml')
    xml = strFromU8(main)
  } catch {
    throw new Error(
      'Não consegui abrir esse .docx. Se for um .doc antigo, salve como .docx e tente de novo.',
    )
  }

  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.getElementsByTagName('parsererror').length) {
    throw new Error('O conteúdo desse documento veio corrompido.')
  }

  const body = dom.getElementsByTagName('w:body')[0] ?? dom.documentElement
  const blocks: DocBlock[] = []
  const tables: string[][][] = []

  for (const node of Array.from(body.children)) {
    if (node.tagName === 'w:p') {
      const block = paragraph(node)
      if (block) blocks.push(block)
    } else if (node.tagName === 'w:tbl') {
      const grid = table(node)
      if (grid.length) tables.push(grid)
    }
  }

  return { blocks, tables }
}

function textOf(p: Element): string {
  let out = ''
  for (const t of Array.from(p.getElementsByTagName('w:t'))) out += t.textContent ?? ''
  // quebras manuais e tabulações viram espaço
  if (p.getElementsByTagName('w:br').length) out = out.replace(/\s+/g, ' ')
  return out.replace(/ /g, ' ').trim()
}

function paragraph(p: Element): DocBlock | null {
  const text = textOf(p)
  if (!text) return null
  const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? ''
  const heading = /^(heading|titulo|título|ttulo)/i.test(style)
  const bullet = p.getElementsByTagName('w:numPr').length > 0 && !heading
  return { text, heading, bullet }
}

function table(tbl: Element): string[][] {
  const rows: string[][] = []
  for (const tr of Array.from(tbl.children)) {
    if (tr.tagName !== 'w:tr') continue
    const cells: string[] = []
    for (const tc of Array.from(tr.children)) {
      if (tc.tagName !== 'w:tc') continue
      const parts: string[] = []
      for (const p of Array.from(tc.getElementsByTagName('w:p'))) {
        const t = textOf(p)
        if (t) parts.push(t)
      }
      cells.push(parts.join('\n'))
    }
    if (cells.some((c) => c.trim())) rows.push(cells)
  }
  return rows
}

/* ── RTF: tira o marcação e devolve o texto ─────────────── */

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
