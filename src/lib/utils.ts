import clsx, { type ClassValue } from 'clsx'

export const cn = (...v: ClassValue[]) => clsx(v)

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function randomPassword(len = 8): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/**
 * O que fica gravado quando o cliente diz que não tem aquilo — ou que
 * prefere não informar. É uma resposta de verdade, não um campo vazio:
 * conta no progresso, satisfaz pergunta obrigatória e aparece assim na
 * planilha, no Word e no resumo do painel.
 */
export const SKIP_ANSWER = 'Não tenho'

export function isSkipped(v: unknown): boolean {
  return typeof v === 'string' && v.trim() === SKIP_ANSWER
}

/**
 * Endereços que o painel usa. Um formulário não pode ficar com um desses
 * como apelido, senão o link do cliente abriria o painel.
 */
export const RESERVED_SLUGS = ['painel', 'entrar', 'f', 'api', 'assets', 'index']

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase())
}

/**
 * Link que vai para o cliente. Curto de propósito: é um endereço que a
 * pessoa lê no WhatsApp e digita no celular se precisar.
 */
export function publicUrl(slug: string): string {
  return `${window.location.origin}/${slug}`
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}

const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (Math.abs(min) < 1) return 'agora'
  if (Math.abs(min) < 60) return RELATIVE.format(-min, 'minute')
  const hours = Math.round(min / 60)
  if (Math.abs(hours) < 24) return RELATIVE.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return RELATIVE.format(-days, 'day')
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0')
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const isUrl = (v: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(v.trim())

/** Texto legível de uma resposta, do jeito que a equipe lê e exporta. */
export function answerText(
  type: string,
  value: string | number | string[] | boolean | null | undefined,
): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
  if (type === 'rating') return `${value} de 5`
  if (type === 'scale') return `${value} de 10`
  return String(value)
}

/**
 * Preto ou branco por cima de uma cor, pelo que tiver mais contraste.
 * Usado nos botões que pintam o fundo com a cor de destaque do cliente:
 * um destaque escuro (pinho, vinho) precisa de texto claro, um claro
 * (ocre) precisa de texto escuro.
 */
export function readableOn(background: string): string {
  const raw = background.replace('#', '').trim()
  const hex = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  if (hex.length !== 6) return '#16130f'
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  return luminance > 0.42 ? '#16130f' : '#f2ede3'
}

function toRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '').trim()
  const h = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number]
}

function relLuminance(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = toRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * amount)
  return `#${[c(ar, br), c(ag, bg), c(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Versão da cor de destaque que dá para ler como TEXTO sobre a superfície.
 * Um pinho escuro sobre fundo preto some — aqui ele é clareado até virar
 * legível, sem perder o matiz.
 */
export function accentOnSurface(accent: string, surface: string, towards: string): string {
  let out = accent
  for (let step = 0; step < 6 && contrastRatio(out, surface) < 3.6; step++) {
    out = mix(out, towards, 0.18)
  }
  return out
}
