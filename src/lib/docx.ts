/**
 * Gera um resumo em Word (.docx) das respostas.
 *
 * Um .docx é só um zip com XML dentro. Em vez de puxar uma biblioteca de
 * 500 kB, a gente monta as quatro partes obrigatórias na mão e fecha o zip
 * com o fflate — que já está no projeto por causa da LEITURA de .docx.
 */
import type { FormRecord, ResponseRecord } from './types'
import { answerText, fullDate } from './utils'

/* ── XML helpers ─────────────────────────────────────────── */

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** Um "run" de texto, quebrando \n em quebras de linha do Word. */
function run(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  const props =
    '<w:rPr>' +
    (opts.bold ? '<w:b/>' : '') +
    (opts.size ? `<w:sz w:val="${opts.size * 2}"/>` : '') +
    (opts.color ? `<w:color w:val="${opts.color.replace('#', '')}"/>` : '') +
    '</w:rPr>'
  const parts = String(text).split(/\r?\n/)
  const body = parts
    .map((line, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(line)}</w:t>`)
    .join('')
  return `<w:r>${props}${body}</w:r>`
}

function para(
  content: string,
  opts: { style?: string; spaceBefore?: number; spaceAfter?: number; rule?: boolean } = {},
) {
  const pPr =
    '<w:pPr>' +
    (opts.style ? `<w:pStyle w:val="${opts.style}"/>` : '') +
    `<w:spacing w:before="${opts.spaceBefore ?? 0}" w:after="${opts.spaceAfter ?? 120}"/>` +
    (opts.rule
      ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="D9DDE8"/></w:pBdr>'
      : '') +
    '</w:pPr>'
  return `<w:p>${pPr}${content}</w:p>`
}

const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

/* ── imagem (logo) ───────────────────────────────────────── */

const EMU_PER_PX = 9525

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

interface LogoPart {
  bytes: Uint8Array
  w: number
  h: number
}

/** Word não lê WebP nem SVG — converte tudo para PNG antes de embutir. */
async function logoAsPng(dataUrl: string, bg?: string | null): Promise<LogoPart | null> {
  try {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const natural = {
      w: img.naturalWidth || 240,
      h: img.naturalHeight || 80,
    }
    const maxW = 420
    const scale = Math.min(1, maxW / natural.w)
    const w = Math.max(1, Math.round(natural.w * scale))
    const h = Math.max(1, Math.round(natural.h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // a logo pode vir com fundo próprio — mantém a cor em vez de virar preto
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    const png = canvas.toDataURL('image/png')
    if (!png.startsWith('data:image/png')) return null
    return { bytes: b64ToBytes(png.split(',')[1]), w, h }
  } catch {
    return null
  }
}

function logoParagraph(logo: LogoPart) {
  const cx = logo.w * EMU_PER_PX
  const cy = logo.h * EMU_PER_PX
  return (
    '<w:p><w:pPr><w:spacing w:after="240"/></w:pPr><w:r><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    '<wp:docPr id="1" name="Logo"/>' +
    '<wp:cNvGraphicFramePr/>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline>' +
    '</w:drawing></w:r></w:p>'
  )
}

/* ── partes fixas do pacote ──────────────────────────────── */

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/>
</w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="52"/><w:color w:val="16181F"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:before="360" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="16181F"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:before="280" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="5646F5"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES = (hasLogo: boolean) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${
  hasLogo ? '<Default Extension="png" ContentType="image/png"/>' : ''
}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOC_RELS = (hasLogo: boolean) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${
  hasLogo
    ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'
    : ''
}
</Relationships>`

/** A4 retrato com margens de 2,5 cm. */
const SECT_PR =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>' +
  '</w:sectPr>'

function documentXml(body: string) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<w:body>${body}${SECT_PR}</w:body></w:document>`
  )
}

/* ── conteúdo do resumo ──────────────────────────────────── */

function responseBody(form: FormRecord, r: ResponseRecord, accent: string): string {
  const out: string[] = []

  out.push(para(run(form.title), { style: 'Title' }))

  const meta = [
    form.client_name,
    `Enviado em ${fullDate(r.submitted_at)}`,
    r.updated_at ? `Corrigido em ${fullDate(r.updated_at)}` : null,
    r.respondent ? `Por ${r.respondent}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  out.push(para(run(meta, { size: 10, color: '6B7280' }), { spaceAfter: 200, rule: true }))

  let section: string | null = null
  form.questions.forEach((q, i) => {
    if (q.section && q.section !== section) {
      section = q.section
      out.push(para(run(section, { color: accent }), { style: 'Heading2' }))
    }
    const a =
      r.answers.find((x) => x.question_id === q.id) ?? r.answers.find((x) => x.label === q.label)
    const text = answerText(q.type, a?.value)

    out.push(
      para(
        run(`${String(i + 1).padStart(2, '0')}. ${q.label}`, { bold: true, size: 11 }),
        { spaceBefore: 160, spaceAfter: 40 },
      ),
    )
    out.push(
      text
        ? para(run(text, { size: 11 }), { spaceAfter: 60 })
        : para(run('— sem resposta —', { size: 10, color: '9CA3AF' }), { spaceAfter: 60 }),
    )
  })

  const answered = form.questions.filter((q) => {
    const a =
      r.answers.find((x) => x.question_id === q.id) ?? r.answers.find((x) => x.label === q.label)
    return !!answerText(q.type, a?.value)
  }).length

  out.push(
    para(
      run(
        `${answered} de ${form.questions.length} perguntas respondidas  ·  documento gerado em ${fullDate(
          new Date().toISOString(),
        )}`,
        { size: 9, color: '9CA3AF' },
      ),
      { spaceBefore: 320 },
    ),
  )

  return out.join('')
}

/* ── montagem e download ─────────────────────────────────── */

async function buildDocx(form: FormRecord, responses: ResponseRecord[]): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')

  const logo = form.theme.logo ? await logoAsPng(form.theme.logo, form.theme.logoBg) : null
  const accent = (form.theme.accent || '#5646f5').replace('#', '').toUpperCase()

  const body = responses
    .map((r) => (logo ? logoParagraph(logo) : '') + responseBody(form, r, accent))
    .join(pageBreak)

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES(!!logo)),
    '_rels/.rels': strToU8(ROOT_RELS),
    'word/document.xml': strToU8(documentXml(body)),
    'word/styles.xml': strToU8(STYLES),
    'word/_rels/document.xml.rels': strToU8(DOC_RELS(!!logo)),
  }
  if (logo) files['word/media/logo.png'] = logo.bytes

  const zipped = zipSync(files, { level: 6 })
  // cópia para um ArrayBuffer próprio — o Blob não aceita a view do fflate direto em alguns navegadores
  return new Blob([zipped.slice()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const safeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 50) || 'respostas'

/** Resumo de UMA resposta. */
export async function exportResponseDocx(form: FormRecord, response: ResponseRecord) {
  const blob = await buildDocx(form, [response])
  const who = response.respondent ? ` - ${safeName(response.respondent)}` : ''
  download(blob, `${safeName(form.title)}${who}.docx`)
}

/** Um documento com todas as respostas, uma por página. */
export async function exportAllResponsesDocx(form: FormRecord, responses: ResponseRecord[]) {
  if (!responses.length) return
  const blob = await buildDocx(form, responses)
  download(blob, `${safeName(form.title)} - ${responses.length} respostas.docx`)
}
