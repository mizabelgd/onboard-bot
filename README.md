# OnboardBot

Protótipo de chatbot baseado em FAQ com RAG para suporte ao onboarding de novos desenvolvedores.

> **TCC** — Desenvolvimento experimental de um protótipo de chatbot baseado em FAQ para suporte ao onboarding de novos desenvolvedores em equipes de software.

---

## O que é

O OnboardBot permite que uma equipe carregue um arquivo FAQ em Markdown. A partir disso, um chatbot responde perguntas de novos desenvolvedores utilizando **RAG (Retrieval-Augmented Generation)**: recupera semanticamente apenas os trechos mais relevantes do FAQ e os utiliza como contexto para gerar a resposta.

**Fluxo de uso:**

1. Usuário faz upload de um `FAQ.md`
2. O sistema divide o conteúdo em chunks e gera embeddings para cada um
3. Ao receber uma pergunta, recupera os top-3 chunks semanticamente mais relevantes
4. Envia os chunks + pergunta ao Gemini Flash, que gera a resposta
5. Um novo upload substitui a base de conhecimento ativa

**O chatbot é conversacional.** O histórico da sessão é mantido no cliente (React state) e as últimas 6 mensagens são enviadas junto com cada pergunta. Isso permite perguntas de acompanhamento naturais — "pode detalhar?", "e no Windows?", "como faço isso para o outro ambiente?" — sem que o usuário precise repetir o contexto. O histórico não é persistido: ao recarregar a página, a conversa começa do zero (a FAQ carregada é mantida).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / Backend | Next.js 16 + React 19 + Tailwind CSS v4 |
| LLM | Google Gemini Flash (`gemini-1.5-flash`) |
| Embeddings | Google Gemini (`text-embedding-004`) |
| Vector Store | Array in-memory (TypeScript puro) |
| Markdown | `react-markdown` |

Sem banco de dados. Sem LangChain. Sem banco vetorial. Uma única API key.

---

## Setup

### Pré-requisitos

- Node.js 20+
- Conta no [Google AI Studio](https://aistudio.google.com/app/apikey) para obter a chave da API Gemini (gratuito)

### Instalação

```bash
git clone <repo>
cd onboard-bot
npm install
npm install @google/generative-ai react-markdown
```

### Variáveis de ambiente

Crie o arquivo `.env.local` na raiz:

```bash
GEMINI_API_KEY=sua_chave_aqui
```

### Rodar localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── page.tsx                    # Página principal
│   └── api/
│       ├── chat/route.ts           # POST /api/chat
│       └── faq/
│           ├── route.ts            # GET /api/faq
│           └── upload/route.ts     # POST /api/faq/upload
├── components/
│   ├── ChatInterface.tsx
│   ├── FAQUpload.tsx
│   └── FAQViewer.tsx
├── lib/
│   ├── gemini.ts                   # Cliente LLM + embeddings
│   ├── rag.ts                      # Chunking, cosine similarity, retrieval
│   └── store.ts                    # Singleton do vector store
└── types/index.ts
uploads/
├── current-faq.md                  # FAQ ativa (gitignored)
└── index.json                      # Índice serializado (gitignored)
```

Documentação de arquitetura completa em [ARQUITETURA.md](./ARQUITETURA.md).

---

## Exemplo de FAQ

O sistema espera um Markdown com headings `##` como separadores de perguntas:

```markdown
## Como solicitar acesso ao Git?

Abra um chamado no Jira com o template "Acesso ferramentas"...

## Como configurar o ambiente local?

Clone o repositório e execute `make setup`...

## Como abrir um pull request?

Crie uma branch a partir de `main`, faça suas alterações...
```

---

## Roadmap de implementação

### Etapa 1 — Infraestrutura RAG `lib/`
> Estimativa: 2–3h

- [x] Criar `src/lib/gemini.ts`
  - Função `generateEmbedding(text: string): Promise<number[]>` — chama `text-embedding-004`
  - Função `generateAnswer(prompt: string): Promise<string>` — chama `gemini-1.5-flash`
- [x] Criar `src/lib/rag.ts`
  - Função `parseMarkdownToChunks(md: string): FAQChunk[]` — split por headings `##`
  - Função `cosineSimilarity(a: number[], b: number[]): number`
  - Função `retrieveTopK(query: string, store: FAQChunk[], k: number): FAQChunk[]`
- [x] Criar `src/lib/store.ts`
  - Singleton `faqStore` com `set(chunks)` e `get(): FAQChunk[]`
- [x] Criar `src/types/index.ts`
  - Tipos: `Message`, `FAQChunk`, `FAQStatus`, `ChatRequest`, `ChatResponse`

---

### Etapa 2 — API Routes
> Estimativa: 2–3h

- [x] Criar `src/app/api/faq/upload/route.ts` — `POST /api/faq/upload`
  - Recebe `FormData` com `file: File`
  - Valida extensão `.md`
  - Salva `current-faq.md` em `uploads/`
  - Chama `parseMarkdownToChunks` → gera embeddings com `Promise.all` → salva no store
  - Retorna `{ success, chunkCount, filename }`
- [x] Criar `src/app/api/faq/route.ts` — `GET /api/faq`
  - Lê `uploads/current-faq.md`
  - Retorna `{ content, status: FAQStatus }`
- [x] Criar `src/app/api/chat/route.ts` — `POST /api/chat`
  - Recebe `{ message, history }`
  - Gera embedding da pergunta → `retrieveTopK(k=3)`
  - Monta prompt RAG com chunks + histórico + pergunta
  - Chama `generateAnswer` → retorna `{ answer, retrievedChunks }`

---

### Etapa 3 — Componentes de UI
> Estimativa: 3–4h

- [x] Criar `src/components/FAQUpload.tsx`
  - Input de arquivo com drag-and-drop ou botão
  - Feedback visual: "Indexando...", "X perguntas indexadas", erros
  - Ao enviar, chama `POST /api/faq/upload`
- [x] Criar `src/components/FAQViewer.tsx`
  - Busca `GET /api/faq` ao montar
  - Renderiza conteúdo com `react-markdown`
  - Exibe nome do arquivo e data de upload
  - Seção colapsável (toggle)
- [ ] Criar `src/components/ChatInterface.tsx`
  - Lista de mensagens com scroll automático
  - Input de texto + botão enviar
  - Estado de loading durante a resposta
  - Envia `POST /api/chat` com histórico acumulado
- [ ] Atualizar `src/app/page.tsx`
  - Layout de 2 colunas: painel esquerdo (FAQUpload + FAQViewer) | painel direito (ChatInterface)
  - Responsivo para mobile

---

### Etapa 4 — Integração e testes manuais
> Estimativa: 2h

- [ ] Testar upload → indexação → chat completo
- [ ] Testar troca de FAQ durante sessão ativa
- [ ] Testar pergunta fora do FAQ (resposta negativa esperada)
- [ ] Verificar no console os chunks recuperados por pergunta
- [ ] Testar upload de arquivo inválido (sem headings `##`, extensão errada)
- [ ] Testar comportamento com restart do servidor (re-indexação a partir do `index.json`)

---

### Etapa 5 — Polish e preparação da demo
> Estimativa: 1–2h

- [ ] Loading spinner durante indexação e geração de resposta
- [ ] Mensagens de erro amigáveis (API key inválida, sem FAQ carregada)
- [ ] Ajuste visual final com Tailwind
- [ ] Gravar screencast da demo (upload → chat)
- [ ] Preparar FAQ de exemplo para a apresentação

---

### Total estimado: 10–14 horas

| Etapa | Horas |
|---|---|
| 1 — Infraestrutura RAG | 2–3h |
| 2 — API Routes | 2–3h |
| 3 — UI | 3–4h |
| 4 — Integração | 2h |
| 5 — Polish | 1–2h |
| **Total** | **10–14h** |

---

## Checklist de entrega

- [ ] `npm run dev` sobe sem erros
- [ ] Upload de FAQ funciona e exibe contagem de chunks
- [ ] Chat responde com base no FAQ carregado
- [ ] Perguntas fora do FAQ recebem resposta negativa explícita
- [ ] Troca de FAQ via novo upload funciona
- [ ] Interface utilizável sem instruções prévias
