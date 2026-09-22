# O fluxo do n8n, nó por nó

Quando o cliente **salva** o formulário, o painel dispara um `POST` e **não
espera resposta**. O fluxo é livre para demorar o quanto quiser.

```
Webhook  →  Edit Fields  →  (WhatsApp / E-mail / Slack …)
```

---

## O que chega

```json
{
  "text": "O formulário \"Diagnóstico de Marketing 2026\" foi preenchido.\nCliente: Padaria Aurora\nRespondeu: contato@aurora.com.br\nRespostas: 12 de 12 — está completo.\nQuando: 22/09/2026, 09:13\nLink: https://painel/f/padaria-aurora-diagnostico-de-marketing-2026",
  "evento": "preenchido",
  "formulario": "Diagnóstico de Marketing 2026",
  "cliente": "Padaria Aurora",
  "respondente": "contato@aurora.com.br",
  "respondidas": 12,
  "total": 12,
  "completo": true,
  "link": "https://painel/f/padaria-aurora-diagnostico-de-marketing-2026",
  "em": "2026-09-22T12:13:44.120Z",
  "sessionId": 94772385328105
}
```

O `text` já é a mensagem pronta. Se você só quer receber o aviso no WhatsApp,
mande esse campo e ignore o resto.

| Campo | Para que serve |
| --- | --- |
| `text` | mensagem montada, pronta para mandar |
| `evento` | `preenchido` no primeiro envio · `corrigido` quando o cliente volta |
| `formulario` · `cliente` · `respondente` | para montar sua própria mensagem |
| `respondidas` · `total` · `completo` | dá para avisar só quando fechar tudo |
| `link` | endereço público do formulário |
| `em` | data/hora em ISO |
| `sessionId` | número novo a cada envio, se o fluxo usar memória |

---

## 1 · Webhook

| Campo | Valor |
| --- | --- |
| HTTP Method | `POST` |
| Path | `gerarprompt` (ou o caminho que você criar) |
| **Respond** | **Immediately** |
| Options → **Allowed Origins (CORS)** | o domínio do painel, ou `*` |

> Aqui *Respond: Immediately* é o certo. O painel não lê a resposta — ele só
> precisa que o n8n aceite a chamada. Assim o cliente nunca fica esperando.

**Atenção ao caminho dos dados.** A saída do Webhook é:

```
{ headers: {…}, params: {…}, query: {…}, body: { text, evento, … } }
```

Ou seja, **os campos ficam dentro de `body`**. É a causa mais comum de "chegou
vazio".

---

## 2 · Edit Fields (Set)

Puxa o que interessa de dentro do `body` para a raiz.

| Nome | Tipo | Valor |
| --- | --- | --- |
| `mensagem` | String | `{{ $json.body.text }}` |
| `evento` | String | `{{ $json.body.evento }}` |
| `formulario` | String | `{{ $json.body.formulario }}` |
| `link` | String | `{{ $json.body.link }}` |

Marque **Include Other Input Fields: off**.

> Dá para pular este nó e usar `{{ $json.body.text }}` direto no nó de envio.
> Ele existe só para o resto do fluxo ficar legível.

---

## 3 · Para onde mandar

Pendure o que você usa. O corpo da mensagem é sempre `{{ $json.mensagem }}`.

**WhatsApp / Telegram / Slack / Discord** — nó de envio, campo de texto:

```
{{ $json.mensagem }}
```

**E-mail** — assunto e corpo:

| Campo | Valor |
| --- | --- |
| Subject | `Formulário {{ $json.evento }}: {{ $json.formulario }}` |
| Text | `{{ $json.mensagem }}` |

**Planilha (Google Sheets)** — uma linha por envio, com os campos soltos.

---

## Variações úteis

**Só avisar quando estiver completo.** Um nó *IF* depois do Webhook:

```
{{ $json.body.completo }}  ·  is true
```

**Mensagem diferente para correção.** Um *Switch* em `{{ $json.body.evento }}`,
com as saídas `preenchido` e `corrigido`.

**Não avisar de formulário de teste.** *IF* com
`{{ $json.body.formulario }}` *does not contain* `teste`.

---

## Testar sem o painel

```bash
curl -X POST https://n8n.nexladesenvolvimento.com.br/webhook/gerarprompt \
  -H "Content-Type: application/json" \
  -d '{"text":"O formulário \"Teste\" foi preenchido.\nCliente: ACME","evento":"preenchido","formulario":"Teste","cliente":"ACME","respondente":null,"respondidas":2,"total":2,"completo":true,"link":"https://painel/f/teste","em":"2026-09-22T12:00:00.000Z","sessionId":123456}'
```

Deu certo quando a mensagem chega no canal. Enquanto der erro, é o fluxo, não o
painel.

---

## Se não chegar nada

1. O fluxo está **ativo** (toggle *Active*)? Em modo de teste o webhook só
   recebe durante o *Listen for test event*.
2. O **Path** bate com o endereço em `VITE_NOTIFY_WEBHOOK`? Um caminho que não
   existe responde `404 · "The requested webhook … is not registered"`.
3. **CORS**: em *Allowed Origins* do nó Webhook, o domínio do painel. Sem isso o
   navegador bloqueia a chamada antes de sair.
4. Abra o console do navegador na tela do cliente — a falha aparece lá, mas de
   propósito não interrompe o envio da resposta.
5. No painel, dentro da resposta, o botão **Reenviar aviso** mostra o erro exato
   que o webhook devolveu.

---

## Se quiser trocar o endereço do webhook

Em `.env.local` do painel:

```
VITE_NOTIFY_WEBHOOK=https://…/webhook/outro-caminho
```
