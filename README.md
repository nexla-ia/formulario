# Formulários

Planilha de perguntas entra, site de formulário sai. Cada cliente ganha um link
próprio (`/f/o-endereco-dele`), com senha opcional, e as respostas voltam para o
painel da equipe — na tela ou em `.xlsx`.

---

## Rodar

```bash
npm install
npm run dev          # http://localhost:5180
```

Login da equipe (Supabase Auth — o usuário existe no banco):

```
nexla@nexla.com.br
```

A senha não fica no código. Para trocá-la: Supabase → Authentication → Users →
*Reset password*. Para criar outra pessoa da equipe, é só adicionar um usuário
nessa mesma tela — qualquer conta autenticada enxerga o painel inteiro.

Se o app subir **sem** as variáveis do Supabase, ele cai em *modo demo* com um
login de faz-de-conta (`demo@demo.app` / `demo`) e guarda tudo no navegador.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o `dist/` |
| `npm run db:push` | aplica `supabase/schema.sql` no banco |
| `npm run db:push -- supabase/seed.sql` | insere dois formulários de exemplo |

---

## Como a equipe usa

1. **Painel → Criar novo.** Três formas de começar:
   - **Enviar arquivo** — planilha (`.xlsx`, `.xls`, `.csv`, `.tsv`, `.ods`) ou
     documento (`.docx`, `.txt`, `.md`, `.rtf`).
   - **Colar texto** — cola a lista de perguntas e ele lê enquanto você escreve.
   - **Modelo pronto** — briefing de marca, onboarding, NPS ou escopo de projeto.

   Quem preferir clica em *Começar do zero* e monta na mão.
2. **Revisa as perguntas.** O sistema já deduziu o tipo de cada resposta. Dá para
   trocar tipo, editar texto, marcar obrigatória, agrupar em seções e arrastar
   para reordenar.
3. **Configura.** Quatro blocos:
   - **Identificação** — título, cliente e uma descrição que só a equipe vê.
   - **Link do cliente** — **gerado sozinho** a partir do cliente + título. Se o
     endereço já existir, entra um sufixo (`-2`, `-3`) automaticamente. Dá para
     abrir em *Editar endereço* e escrever à mão; aí ele confere disponibilidade
     na hora e mostra ✓ ou ✗.
   - **Acesso** — No ar / Rascunho / Encerrado em três cartões, e um interruptor
     *Proteger com senha* que já gera a senha (com botão de trocar e de copiar).
   - **Textos que o cliente lê** — abertura e agradecimento.

   A **logo** fica no alto, dentro de *Identificação*, com a **prévia ao vivo**
   do lado. Na coluna da direita: **cor do formulário**, fundo claro/escuro e
   modo de preenchimento.
4. **Manda.** O bloco *Para mandar ao cliente* (na última tela do assistente e no
   topo de cada formulário) tem um botão que copia link e senha já formatados:

   ```
   Link:
   https://…/f/endereco-do-cliente

   Senha:
   h3gbmxcj
   ```

   Dá também para copiar só o link, só a senha, ou a versão com saudação.
5. **Acompanha.** Aba *Respostas* no formulário: abre cada envio na tela,
   baixa **planilha** (`.xlsx`) ou um **resumo em Word** (`.docx`) — uma resposta
   por página, com a logo e as seções. Toda vez que o cliente salva, a equipe
   recebe um **aviso automático** (ver abaixo).

### Documento do Word, texto solto e colagem

Nem sempre as perguntas vêm em planilha. O leitor aceita também:

| Origem | Como é lido |
| --- | --- |
| `.docx` **com tabela** | a tabela é tratada exatamente como planilha (mesmas colunas) |
| `.docx` **texto corrido** | cada parágrafo vira uma pergunta; parágrafos com estilo de **Título** viram seções; itens de lista viram alternativas |
| `.txt`, `.md`, `.rtf` | uma pergunta por linha |
| **Colar texto** | igual ao `.txt`, direto na tela |

Regras do texto solto:

- Uma pergunta por linha.
- Linha terminada em `:` (ou em MAIÚSCULAS, ou `## assim`) vira **seção**.
- Alternativas vêm logo abaixo da pergunta, começando com `-`, `•`, `( )` ou `a)`.
- `(texto longo)`, `(data)`, `(número)`, `(escala)` … no fim da linha **forçam o tipo**.
- `(opcional)` tira a obrigatoriedade; `*` no fim força obrigatória.
- Se todas as linhas com marcador acabarem viradas alternativas de uma pergunta só,
  o leitor percebe e converte tudo de volta em perguntas, avisando na tela.

PDF ainda não é lido — salve como `.docx` ou copie o texto e use *Colar texto*.
`.doc` antigo também não: abra no Word e salve como `.docx`.

### Como montar a planilha

Uma linha por pergunta. Colunas reconhecidas (em qualquer ordem, com ou sem
acento, em português ou inglês):

| Coluna | Aceita também | Para que serve |
| --- | --- | --- |
| `Pergunta` | questão, título, campo, label | o texto da pergunta |
| `Tipo` | type, formato | formato da resposta (opcional — ver abaixo) |
| `Obrigatória` | obrigatorio, required | `sim` / `não` |
| `Opções` | alternativas, options, escolhas | separadas por `\|` |
| `Seção` | grupo, categoria, bloco, etapa | agrupa perguntas |
| `Ajuda` | descrição, instrução, hint | texto pequeno abaixo da pergunta |

Tipos aceitos: `texto curto`, `texto longo`, `número`, `e-mail`, `telefone`,
`link`, `data`, `lista suspensa`, `escolha única`, `múltipla escolha`, `sim/não`,
`estrelas`, `escala`.

Atalhos que economizam trabalho:

- **Coluna `Tipo` vazia** → o sistema adivinha pelo texto da pergunta
  (`E-mail do responsável` vira e-mail, `Prazo desejado` vira data, e por aí).
- **Sem coluna `Obrigatória`** → todas viram obrigatórias. Escreve `(opcional)`
  no fim da pergunta para liberar, ou `*` no fim para forçar obrigatória.
- **Sem cabeçalho nenhum** → assume a ordem `pergunta | tipo | obrigatória | opções`.
- **Linha só com a coluna `Seção` preenchida** (ou `## Nome do bloco` na coluna de
  pergunta) → vira um título de seção para as perguntas seguintes.

---

## Aviso de formulário preenchido (n8n)

Quando o cliente **salva**, o sistema dispara sozinho um `POST` para um webhook
com uma frase pronta. Quem recebe (n8n, Make, Zapier) decide o que fazer com
ela — WhatsApp, e-mail, canal do Slack, uma linha numa planilha.

Endereço em `.env.local`:

```
VITE_NOTIFY_WEBHOOK=https://n8n.nexladesenvolvimento.com.br/webhook/gerarprompt
```

O corpo traz a frase montada em `text` e os mesmos dados soltos ao lado, para
quem recebe não ter que remontar nada:

```json
{
  "text": "O formulário \"Diagnóstico de Marketing 2026\" foi preenchido.
Cliente: Padaria Aurora
Respondeu: contato@aurora.com.br
Respostas: 12 de 12 — está completo.
Quando: 22/09/2026, 09:13
Link: https://painel/f/padaria-aurora-diagnostico-de-marketing-2026",
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

- **`evento`** é `preenchido` no primeiro envio e `corrigido` quando o cliente
  reabre o link e salva de novo — dá para mandar mensagens diferentes.
- **`respondidas` / `total` / `completo`** dizem se ainda falta coisa.
- **`sessionId`** é um número novo a cada envio, caso o fluxo use memória.

O envio é **solta e esquece**: sai com `keepalive` (o cliente costuma fechar a
página logo depois de salvar) e nunca lança erro. Se o webhook estiver fora do
ar, o cliente não vê nada e a resposta dele continua salva — só o aviso se
perde. Para reenviar, o painel tem **Reenviar aviso** dentro da resposta, que
mostra o erro do webhook quando falha.

Tudo que o cliente digita passa por uma limpeza antes de sair (controle, metade
solta de emoji, espaço invisível de Word e PDF, e um corte em 400 caracteres por
campo), para não quebrar o JSON de quem recebe.

O fluxo do n8n, nó por nó, está em [`n8n/fluxo.md`](n8n/fluxo.md).

Do lado do n8n só há um requisito: **CORS liberado** para o domínio do painel,
no campo *Allowed Origins* do nó Webhook. O *Respond* pode ficar em
**Immediately** — o painel não espera resposta nenhuma.

> O endereço acima é o webhook que já está no ar. Se criar um caminho separado
> só para o aviso, troque a variável — o painel não depende do nome. Um caminho
> que não existe devolve `404 · not registered` e o aviso se perde em silêncio;
> o botão **Reenviar aviso** mostra exatamente esse erro.

Lembre que isso manda dados do cliente para fora do sistema — quem recebe o
webhook passa a ter uma cópia do nome, do e-mail e do link.

## O que o cliente vê

1. **Portão de senha** (se o formulário tiver senha). A senha errada faz o
   cartão negar com a cabeça (GSAP), o cadeado chacoalhar e uma onda vermelha
   sair dele — com vibração no celular. A senha certa abre a trava do cadeado
   (anime.js), solta oito faíscas em volta e o cartão sobe e some antes de
   entrar o formulário.
2. **Abertura** — logo, título, quantas perguntas e tempo estimado.
3. **Perguntas** — em um de três modos, escolhido em *Aparência → Como o cliente
   responde*:
   - **Tudo aberto na página** (padrão) — todos os campos visíveis de uma vez,
     um embaixo do outro. O cliente rola, preenche e confere no fim.
   - **Lista com toque** — todas as perguntas numa tela só, cada uma num cartão.
     O cliente toca numa e responde numa janelinha, com *Anterior* e *Próxima*
     para correr sem fechar. O cartão respondido ganha um ✓ verde e mostra a
     resposta embaixo. Nesse modo não há capa nem tela de revisão separada — a
     lista já é as duas coisas.
   - **Uma pergunta por tela** — avança de uma em uma, com revisão no fim.
   Em qualquer modo, embaixo do campo tem **Não tenho / não quero informar**.
   O cliente que não tem site, não tem Instagram ou prefere não passar um dado
   marca isso e segue — inclusive em pergunta obrigatória. Fica gravado como
   `Não tenho`, conta no progresso e aparece assim na planilha, no Word e no
   painel, em vez de virar um campo vazio que ninguém sabe se foi esquecido.

4. **Revisão** (nos modos *uma por tela* e *tudo aberto*) — antes de enviar, ele
   vê **tudo que respondeu** numa lista, com um botão *Editar* em cada item que
   leva de volta àquela pergunta. Só depois de confirmar é que a resposta é
   gravada. No modo *lista com toque*, apertar **Enviar** com alguma obrigatória
   em branco abre a janelinha exatamente naquela pergunta.
5. **Agradecimento** — com o texto que a equipe escreveu.

### Corrigir depois de enviar

Com *"Cliente pode corrigir depois de enviar"* ligado (padrão), o formulário
vira um documento vivo: o cliente reabre o **mesmo link com a mesma senha** e
**cai direto na lista do que já enviou** — sem passar pela capa. Cada item tem um
botão *Editar* que leva àquela pergunta; no fim, *Salvar alterações*. Quem
preferir passar tela a tela clica em *Rever pergunta por pergunta*.

Fica **uma resposta só**, com o contador de correções e a data da última. Se o
formulário ganhou uma pergunta obrigatória depois que o cliente respondeu, o
*Salvar* leva direto até ela.

A senha é a chave desse acesso. Sem senha, qualquer um com o link consegue ver e
trocar o que já foi respondido; o painel avisa isso na hora de configurar.

Desligando a chave, volta ao comportamento antigo: cada envio vira uma resposta
nova e não dá para voltar atrás.

As respostas em andamento ficam salvas no navegador do cliente: se ele fechar a
aba no meio, volta de onde parou (e o rascunho local só vence o servidor se for
mais recente).

## Estado do link do cliente

| Situação | O que o cliente vê |
| --- | --- |
| **No ar** | o formulário (com o portão de senha antes, se tiver senha) |
| **Rascunho** | "Este formulário ainda não abriu" |
| **Encerrado** | "Este formulário foi encerrado" |

---

## Banco (Supabase)

Já está ligado. Duas tabelas e três funções:

- `forms` — um registro por formulário; as perguntas moram numa coluna `jsonb`.
- `responses` — um registro por envio; as respostas moram numa coluna `jsonb`.
- `form_public(slug)` / `form_unlock(slug, senha)` / `form_submit(...)` — as três
  RPCs que a página do cliente usa. São `security definer`: nunca devolvem a
  coluna `password`, nem as perguntas de um formulário em rascunho.

Para recriar em outro projeto:

```bash
# .env.local
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:5432/postgres

npm run db:push
```

Se as tabelas não existirem, o app **não quebra**: cai em modo demo, salva tudo
no `localStorage` e mostra uma faixa no topo com o passo a passo para ligar o
banco.

---

## Segurança

**Login.** É o Supabase Auth de verdade (`src/lib/auth.tsx`). A senha nunca
passa pelo código do front nem vai para o bundle: o navegador manda direto para
o Supabase, recebe um token `authenticated` e guarda a sessão (renovada
sozinha). Sair limpa a sessão.

**RLS.** As tabelas `forms` e `responses` só respondem para `authenticated`.
A chave anon sozinha não lê nada delas — dá para conferir:

```bash
curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "$SUPABASE_URL/rest/v1/forms?select=slug,password"     # => []
```

**O link do cliente** não precisa de login porque não toca nas tabelas: ele
chama só as três funções `form_public` / `form_unlock` / `form_submit`, que são
`security definer` e devolvem apenas o que o cliente pode ver. A coluna
`password` nunca sai do banco por ali.

**Ponto em aberto:** a senha do formulário é guardada em texto puro. Ela protege
contra link vazado, não é credencial de usuário — quem entra no painel consegue
lê-la (de propósito, para poder mandar ao cliente). Se isso mudar, troque por
`crypt()`/`pgcrypto` dentro das RPCs.

---

## Visual

Referência é o Google Forms: fundo cinza-claro, cartões brancos de cantos
arredondados, uma cor de destaque e tipografia grande e limpa.

- **Fonte:** [Figtree](https://fonts.google.com/specimen/Figtree) em todos os
  tamanhos — sem serifa, x-height alto, boa leitura em telinha de celular.
- **Cor da marca:** índigo `#5646f5`. Cada formulário escolhe a própria cor entre
  8 opções, e ela pinta o topo do cartão, os botões e o fundo da página do
  cliente.
- **Contraste:** a cor do texto sobre a cor escolhida é calculada
  (`readableOn` / `accentOnSurface` em `src/lib/utils.ts`), então nenhum botão
  fica ilegível se o cliente pedir um amarelo ou um azul-marinho.
- **Fundo claro ou escuro** por formulário, com a mesma cor de destaque.
- **Logo da equipe** — envia PNG, JPG, SVG ou WebP em *Identificação → Logo*. A
  imagem é reduzida para 900px e convertida em WebP no navegador (um PNG de
  10 KB vira ~4 KB), então vai inteira dentro do `theme` do formulário — sem
  bucket, sem upload separado. Marcando *"usar em todos os formulários novos"*
  ela fica guardada e já entra sozinha da próxima vez.
  Aparece no portão de senha, na abertura, no topo durante o preenchimento e na
  tela de agradecimento.
- **Cor de fundo da logo** — o sistema lê oito pontos da borda da imagem. Se for
  fundo chapado, oferece a cor (*"Essa logo tem fundo #11111f · usar"*) e, uma
  vez aplicada, encosta a logo num campo arredondado dessa cor em vez de um
  quadrado branco destoando da tela. Logo recortada (fundo transparente) ou com
  borda variada não gera sugestão nenhuma — não se inventa cor. A mesma cor vai
  para o resumo em Word. Dá para tirar a qualquer momento no mesmo botão.

## Stack e por que cada peça

React 19 + Vite + TypeScript + Tailwind v4 + Supabase.

As três bibliotecas de animação estão em uso, cada uma no que faz melhor:

- **Motion** (`motion/react`) — tudo que depende do ciclo de vida do componente:
  molas de hover/press nos botões, troca de tela, cartões que sobem ao entrar na
  viewport, arrastar-e-soltar das perguntas (`Reorder`), acordeões com altura
  animada, barra de progresso, indicadores que deslizam entre abas
  (`layoutId`), toasts e modais.
- **GSAP** — coreografia de entrada, onde importa a **ordem entre elementos
  independentes**: a abertura do login, o portão de senha, a tela de abertura do
  cliente e a de "enviado". `timeline()` com offsets é mais legível que encadear
  `delay` à mão, e os blobs de gradiente do login ficam em loop com
  `repeat: -1, yoyo: true`.
- **anime.js** — dois momentos pontuais que pedem controle fino de valor:
  os contadores do painel (`CountUp`) e o tique de sucesso, que desenha o
  círculo e o traço via `strokeDashoffset` e dispara os raios com `stagger`
  (`CheckBurst`, em `src/components/ui/Chrome.tsx`).

Ondulação estilo Material nos botões é CSS puro (`.ripple-dot`), disparada a
partir do ponto clicado.

O `xlsx` (900 kB) e todo o painel entram por `import()` dinâmico — o link do
cliente não baixa nada de admin nem o leitor de planilha.

O `.docx` de saída é montado à mão: um `.docx` é só um zip com quatro arquivos
XML dentro, então `src/lib/docx.ts` escreve o XML e fecha o zip com o mesmo
`fflate` que já era usado para **ler** documentos. Evita uma biblioteca de
~500 kB só para exportar. A logo é reconvertida para PNG antes de entrar (Word
não abre WebP).

## Mapa dos arquivos

```
src/
  lib/
    db.ts          camada de dados — Supabase ou localStorage, mesma API
    sheet.ts       leitura de planilha/documento/texto, modelo, exportação
    doc.ts         abre o .docx (zip + XML) e o .rtf
    templates.ts   os quatro modelos prontos de perguntas
    types.ts       formulário, pergunta, resposta
    auth.tsx       login (Supabase Auth, com queda para demo sem banco)
    utils.ts       slug, máscaras, datas, formatação de resposta
    brand.ts       logo da equipe (redimensiona, converte e guarda o padrão)
    docx.ts        gera o resumo em Word (zip + XML montados na mão)
    notify.ts      monta e dispara o aviso de formulário preenchido
    anim.ts        molas e variantes compartilhadas do Motion
  components/
    AppShell.tsx   moldura do painel
    QuestionList.tsx  editor de perguntas com arrastar-e-soltar
    AnswerInput.tsx   renderiza cada tipo de resposta no lado do cliente
    ui/Button.tsx  botões com ondulação e mola
    ui/Field.tsx   input, textarea, select, switch, segmented
    ui/Chrome.tsx  logo, badge, CountUp, CheckBurst, estado vazio
    ui/Feedback.tsx  toast, modal, confirmação, esqueleto
  pages/
    Login.tsx      /entrar
    Dashboard.tsx  /painel
    NewForm.tsx    /painel/novo   (assistente de 4 passos)
    FormDetail.tsx /painel/f/:id  (perguntas · ajustes · respostas)
    PublicForm.tsx /f/:slug       (a tela que o cliente vê)
supabase/
  schema.sql       tabelas, RPCs e RLS
  seed.sql         dois formulários de exemplo
scripts/
  db-push.mjs      aplica um .sql no banco
```

---

## Publicar

`vercel.json` e `public/_redirects` já mandam todas as rotas para o
`index.html` (precisa disso, senão `/f/qualquer-coisa` dá 404 no servidor).

Na Vercel/Netlify, configura as variáveis `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`. `DATABASE_URL` **não** vai para o deploy — é só para
rodar `db:push` da sua máquina.

Depois do primeiro deploy, os links gerados passam a usar o domínio real
(`publicUrl()` usa `window.location.origin`).
