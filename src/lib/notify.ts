/**
 * Avisa que um formulário foi preenchido.
 *
 * Quando o cliente salva, o sistema dispara um POST para um webhook
 * (n8n, Make, Zapier, o que for) com uma frase pronta em `text` e os
 * campos soltos ao lado, para quem recebe montar WhatsApp, e-mail ou
 * mensagem de canal sem ter que remontar nada.
 *
 * O envio é "solta e esquece": se o webhook estiver fora do ar, o
 * cliente não vê erro nenhum e a resposta dele continua salva.
 */
import type { FormRecord } from './types'
import { fullDate, publicUrl } from './utils'

const NL = String.fromCharCode(10)

/** Tira controle, emoji quebrado e espaço invisível antes de sair do sistema. */
function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[\ud800-\udbff](?![\udc00-\udfff])/g, '')
    .replace(/(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1')
    .replace(/[ ​-‍﻿]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 400)
}

export const NOTIFY_WEBHOOK =
  (import.meta.env.VITE_NOTIFY_WEBHOOK as string | undefined) ??
  'https://n8n.nexladesenvolvimento.com.br/webhook/gerarprompt'

export type NotifyEvent = 'preenchido' | 'corrigido'

export interface NotifyPayload {
  /** frase pronta para mandar em WhatsApp, e-mail ou canal */
  text: string
  /** 'preenchido' no primeiro envio, 'corrigido' quando o cliente volta */
  evento: NotifyEvent
  formulario: string
  cliente: string | null
  respondente: string | null
  /** quantas perguntas já têm resposta, de quantas existem */
  respondidas: number
  total: number
  completo: boolean
  link: string
  em: string
  /** número aleatório por envio — serve de chave em fluxos com memória */
  sessionId: number
}

/** Número novo a cada chamada. */
function newSessionId(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] * 100000 + Math.floor(Math.random() * 100000)
}

export function buildNotice(
  form: Pick<FormRecord, 'title' | 'slug' | 'client_name'>,
  input: {
    evento: NotifyEvent
    respondente?: string | null
    respondidas: number
    total: number
  },
): NotifyPayload {
  const titulo = clean(form.title) || 'Formulário sem título'
  const cliente = clean(form.client_name) || null
  const quem = clean(input.respondente) || null
  const link = publicUrl(form.slug)
  const agora = new Date().toISOString()
  const completo = input.total > 0 && input.respondidas >= input.total
  const faltam = Math.max(0, input.total - input.respondidas)

  const lines: string[] = []
  lines.push(
    input.evento === 'corrigido'
      ? `O formulário "${titulo}" foi corrigido.`
      : `O formulário "${titulo}" foi preenchido.`,
  )
  if (cliente) lines.push(`Cliente: ${cliente}`)
  if (quem) lines.push(`Respondeu: ${quem}`)
  lines.push(
    completo
      ? `Respostas: ${input.respondidas} de ${input.total} — está completo.`
      : `Respostas: ${input.respondidas} de ${input.total} — ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`}.`,
  )
  lines.push(`Quando: ${fullDate(agora)}`)
  lines.push(`Link: ${link}`)

  return {
    text: lines.join(NL),
    evento: input.evento,
    formulario: titulo,
    cliente,
    respondente: quem,
    respondidas: input.respondidas,
    total: input.total,
    completo,
    link,
    em: agora,
    sessionId: newSessionId(),
  }
}

/**
 * Dispara o aviso. Nunca lança: o retorno diz se o webhook aceitou, e
 * quem chama pode simplesmente ignorar.
 */
export async function sendNotice(
  payload: NotifyPayload,
  opts: { keepalive?: boolean } = {},
): Promise<{ ok: boolean; detail?: string }> {
  if (!NOTIFY_WEBHOOK) return { ok: false, detail: 'Nenhum webhook configurado.' }
  try {
    const res = await fetch(NOTIFY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // o cliente costuma sair da página logo depois de salvar
      keepalive: opts.keepalive ?? true,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `${res.status} · ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Falha de rede.' }
  }
}

/** Atalho usado na tela do cliente: monta e dispara, sem travar nada. */
export function notifyFilled(
  form: Pick<FormRecord, 'title' | 'slug' | 'client_name'>,
  input: {
    evento: NotifyEvent
    respondente?: string | null
    respondidas: number
    total: number
  },
): Promise<{ ok: boolean; detail?: string }> {
  return sendNotice(buildNotice(form, input))
}
