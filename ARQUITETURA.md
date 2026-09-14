# OnboardBot — Arquitetura do MVP

> **TCC:** Desenvolvimento experimental de um protótipo de chatbot baseado em FAQ para suporte ao onboarding de novos desenvolvedores em equipes de software.

---

## 1. Visão Geral

O **OnboardBot** é um chatbot de suporte ao onboarding que responde perguntas de novos desenvolvedores com base em um arquivo FAQ em Markdown carregado pela equipe. O sistema implementa o padrão **RAG (Retrieval-Augmented Generation)**: ao invés de enviar o FAQ inteiro ao modelo a cada pergunta, o sistema recupera semanticamente apenas os trechos mais relevantes e os utiliza como contexto para a geração da resposta.

**Objetivo acadêmico:** Demonstrar na prática a aplicação do padrão RAG com embeddings semânticos, avaliando seu impacto no suporte ao onboarding de desenvolvedores.

---

## 2. Stack Completa

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS v4 | Já configurado no projeto; full-stack em um repositório |
| **Backend** | Next.js Route Handlers (App Router) | Zero overhead; sem servidor separado |
| **LLM** | Ollama (`phi3`) — execução local | Zero custo; sem API key; modelo compacto adequado para demo |
| **Embeddings** | `all-MiniLM-L6-v2` via `@huggingface/transformers` (ONNX) | Executa dentro do processo Node.js; 384 dimensões; sem serviço externo |
| **Vector Store** | ChromaDB — banco vetorial persistente | Persistência entre restarts sem reindexação; busca vetorial nativa com cosine |
| **Chunking** | Parser manual por headings `##` | FAQ já é naturalmente estruturado por seções |
| **Similaridade** | ChromaDB (HNSW + cosine) | Delegada ao banco vetorial; cosine similarity via `hnsw:space: cosine` |
| **Renderização Markdown** | `react-markdown` | Leve; sem dependências pesadas |
| **Orquestração** | Docker Compose | Sobe app + Ollama + ChromaDB com um único comando |
| **Hospedagem (demo)** | Local com `make docker-setup` ou `npm run dev` | Sem necessidade de deploy para a apresentação |

### Dependências principais

```bash
npm install @huggingface/transformers chromadb react-markdown
```

### Variáveis de ambiente

```bash
# .env.local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi3
CHROMA_URL=http://localhost:8000
RAG_TOP_K=3
HISTORY_LIMIT=6
```

Sem API key. Sem serviços externos. Execução 100% local.

---

## 3. Comparação de Abordagens RAG

| Abordagem | Complexidade | Serviços Externos | Valor Acadêmico | Escolhida |
|---|---|---|---|---|
| Context stuffing (sem RAG) | Mínima | Nenhum | Baixo | — |
| RAG manual + HuggingFace Embeddings | Baixa | Nenhum | Alto | — |
| RAG com LangChain.js | Média | Nenhum (opcional) | Alto | — |
| **RAG manual + stack local (Ollama + HuggingFace + ChromaDB)** | **Média** | **Nenhum** | **Alto** | **✅** |

**Por que RAG manual com stack 100% local:**
- Expõe cada componente do pipeline de forma transparente (adequado para o artigo)
- Sem abstração: chunking, embedding, similarity e geração são todos legíveis e controlados
- Zero custo e zero dependência de APIs externas — reprodutível por qualquer avaliador
- ChromaDB persiste embeddings entre restarts, eliminando reindexação
- `all-MiniLM-L6-v2` (384 dims) via ONNX roda dentro do processo Node.js sem microserviço adicional

---

## 4. Fluxo Completo da Aplicação

### 4.1 Upload e Indexação

```
Usuário faz upload de FAQ.md
         │
         ▼
POST /api/faq/upload
         │
         ▼
Leitura do conteúdo do arquivo (text/plain)
         │
         ▼
Chunking: split por headings ## → array de chunks
   cada chunk = heading + parágrafo(s) abaixo dele
         │
         ▼
Para cada chunk:
   all-MiniLM-L6-v2 (ONNX em Node.js) → vetor de 384 dimensões
         │
         ▼
Persistir no ChromaDB: { id, embedding, document, metadata{ heading, filename, indexedAt } }
         │
         ▼
Retornar: { success: true, chunkCount: N, filename: "FAQ.md" }
```

### 4.2 Consulta via Chat (Pipeline RAG)

```
Usuário digita pergunta no chat
         │
         ▼
POST /api/chat  ← { message, history[] }
         │
         ▼
[RETRIEVAL] all-MiniLM-L6-v2 (ONNX) → embedding da pergunta (384 dims)
         │
         ▼
ChromaDB query: cosine similarity → top-K chunks mais similares
         │
         ▼
Top-3 chunks com maior similaridade
         │
         ▼
[AUGMENTATION] Montar prompt RAG:
   - Instrução do sistema (responda APENAS com o FAQ)
   - Chunks recuperados como contexto
   - Histórico recente da conversa
   - Pergunta do usuário
         │
         ▼
[GENERATION] Ollama phi3 (local) → gera resposta
         │
         ▼
Retornar: { answer: string, retrievedChunks: string[] }
         │
         ▼
Exibir resposta no chat
```

### 4.3 Memória Conversacional

O chatbot é **conversacional**: o usuário pode fazer perguntas de acompanhamento sem repetir o contexto anterior.

**Como funciona:**

- O histórico de mensagens é mantido exclusivamente no **cliente** (React state) — sem sessão no servidor, sem banco de dados.
- A cada nova mensagem, o frontend envia `{ message, history[] }` onde `history` contém as mensagens anteriores da sessão.
- O servidor inclui as **últimas 6 mensagens** do histórico no prompt enviado ao Ollama phi3 (3 pares pergunta/resposta). Esse limite evita que o prompt cresça indefinidamente e estoure o orçamento de tokens do modelo local.
- O modelo pode referenciar respostas anteriores para dar continuidade à conversa.

**Exemplos de perguntas de acompanhamento suportadas:**

```
Usuário: Como configuro o ambiente local?
Bot: [resposta com base no FAQ]

Usuário: E no Windows, o processo é o mesmo?
Bot: [responde considerando que a pergunta é sobre o mesmo tópico]

Usuário: Pode detalhar o passo 3?
Bot: [detalha sem precisar repetir a pergunta original]
```

**Limite de memória:** o histórico não é persistido entre sessões. Ao recarregar a página, a conversa recomeça do zero — a FAQ carregada permanece ativa, mas as mensagens anteriores são perdidas. Isso é esperado e documentado como limitação do MVP.

### 4.5 Troca da Base de Conhecimento

```
Usuário faz upload de novo arquivo .md
         │
         ▼
POST /api/faq/upload
         │
         ▼
Limpar coleção ChromaDB (delete todos os chunks anteriores)
Reindexar novo FAQ no ChromaDB
Sobrescrever uploads/current-faq.md
         │
         ▼
Chatbot passa a usar o novo FAQ imediatamente
```

### 4.6 Pergunta Fora do FAQ

O prompt instrui explicitamente o modelo:

> "Se a pergunta não puder ser respondida com os trechos de FAQ fornecidos, responda: 'Não encontrei essa informação no FAQ atual. Por favor, consulte seu time ou supervisor.'"

---

## 5. Estratégia de Prompt RAG

```
[System Instruction]
Você é um assistente de onboarding de desenvolvedores chamado OnboardBot.
Responda APENAS com base nos trechos de FAQ fornecidos abaixo.
Não use conhecimento externo.
Se a pergunta não puder ser respondida com os trechos fornecidos,
diga claramente: "Não encontrei essa informação no FAQ atual.
Por favor, consulte seu time ou supervisor."
Seja direto e objetivo.

[Contexto Recuperado]
---
Trecho 1: {heading_1}
{content_1}

---
Trecho 2: {heading_2}
{content_2}

---
Trecho 3: {heading_3}
{content_3}

[Histórico da Conversa]
{últimas 6 mensagens — 3 pares pergunta/resposta — mantidas no cliente e enviadas a cada request}

[Pergunta]
{mensagem do usuário}
```

---

## 6. Estrutura de Pastas

```
/onboard-bot
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Layout principal (upload + chat + viewer)
│   │   ├── layout.tsx                    # Root layout
│   │   ├── globals.css                   # Estilos globais
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Rota /dashboard — métricas acadêmicas
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts              # POST /api/chat → retrieval + geração
│   │       ├── faq/
│   │       │   ├── route.ts              # GET + DELETE /api/faq
│   │       │   └── upload/
│   │       │       └── route.ts          # POST /api/faq/upload → indexa no ChromaDB
│   │       └── metrics/
│   │           ├── route.ts              # GET /api/metrics — métricas calculadas
│   │           ├── feedback/route.ts     # POST /api/metrics/feedback
│   │           └── session/route.ts      # POST /api/metrics/session
│   ├── components/
│   │   ├── ChatInterface.tsx             # Área de mensagens + input + feedback 👍👎
│   │   ├── FAQUpload.tsx                 # Upload de arquivo + status de indexação
│   │   ├── FAQViewer.tsx                 # Exibe FAQ em markdown formatado
│   │   └── MetricsDashboard.tsx          # Dashboard de métricas acadêmicas
│   ├── lib/
│   │   ├── embeddings.ts                 # all-MiniLM-L6-v2 via @huggingface/transformers (ONNX)
│   │   ├── llm.ts                        # Ollama HTTP API (phi3)
│   │   ├── rag.ts                        # Chunking, cosineSimilarity (avaliação), retrieval
│   │   ├── store.ts                      # Singleton ChromaDB (client + collection)
│   │   └── metrics-store.ts              # Singleton de métricas com persistência em JSON
│   └── types/
│       └── index.ts                      # Tipos: Message, FAQChunk, FAQStatus, métricas, etc.
├── uploads/                              # Gitignored
│   ├── current-faq.md                    # FAQ original carregada
│   └── metrics.json                      # Métricas de sessões e feedback
├── .env.local                            # Variáveis locais (gitignored)
├── Dockerfile                            # Build multi-stage para produção
├── docker-compose.yml                    # App + Ollama + ChromaDB
├── Makefile                              # Atalhos de desenvolvimento e Docker
├── ARQUITETURA.md                        # Este documento
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. Modelo de Dados Mínimo

```typescript
// src/types/index.ts

type MessageRole = 'user' | 'assistant'

interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
}

interface FAQChunk {
  text: string          // heading + content (o que vai no prompt)
  heading: string       // ex: "Como solicitar acesso ao Git?"
  embedding: number[]   // 384 dimensões — all-MiniLM-L6-v2
}

interface FAQStore {
  chunks: FAQChunk[]
  filename: string
  indexedAt: string
}

interface FAQStatus {
  loaded: boolean
  filename?: string
  indexedAt?: string
  chunkCount?: number
}

interface ChatRequest {
  message: string
  history: Message[]
}

interface ChatResponse {
  answer: string
  retrievedChunks: string[]   // trechos usados — útil para debug/artigo
}

interface UploadResponse {
  success: boolean
  chunkCount: number
  filename: string
}

// ChatResponse — estendida com timing a partir da Etapa 6
interface ChatResponse {
  answer: string
  retrievedChunks: string[]
  timing?: {
    retrievalTimeMs: number   // embedding (ONNX) + ChromaDB query + top-K
    generationTimeMs: number  // chamada ao Ollama phi3
    totalTimeMs: number
  }
}
```

### Tipos de observabilidade (Etapa 6)

```typescript
// Feedback por mensagem individual
interface MessageFeedback {
  messageId: string
  sessionId: string
  value: 'positive' | 'negative'
  timestamp: string
}

// Timing de cada resposta gerada
interface ResponseTiming {
  messageId: string
  sessionId: string
  retrievalTimeMs: number
  generationTimeMs: number
  totalTimeMs: number
  timestamp: string
}

// Resumo de sessão enviado ao encerrar a conversa
interface SessionSummary {
  sessionId: string
  startedAt: string
  endedAt: string
  userMessageCount: number
  resolved?: boolean           // "Sua dúvida foi resolvida?"
  satisfactionScore?: 1|2|3|4|5  // avaliação 1–5 estrelas (opcional)
}

// Estrutura do arquivo uploads/metrics.json
interface MetricsFile {
  feedbacks: MessageFeedback[]
  timings: ResponseTiming[]
  sessions: SessionSummary[]
}
```

---

## 8. API Routes

| Método | Rota | Body / Params | Resposta |
|---|---|---|---|
| `POST` | `/api/faq/upload` | `FormData { file: File }` | `UploadResponse` |
| `GET` | `/api/faq` | — | `{ content: string, status: FAQStatus }` |
| `DELETE` | `/api/faq` | — | `{ success: true }` |
| `POST` | `/api/chat` | `ChatRequest` | `ChatResponse` (inclui `timing` na Etapa 6) |
| `GET` | `/api/metrics` | — | Métricas calculadas (eficiência, efetividade, satisfação) |
| `POST` | `/api/metrics/feedback` | `MessageFeedback` | `{ success: true }` |
| `POST` | `/api/metrics/session` | `SessionSummary` | `{ success: true }` |

---

## 9. Funcionalidades Obrigatórias

- [ ] Upload de arquivo Markdown (`.md`) via interface web
- [ ] Parsing e chunking do Markdown por headings `##`
- [ ] Geração de embeddings por chunk via `all-MiniLM-L6-v2` (ONNX em Node.js, 384 dims)
- [ ] Armazenamento dos embeddings no ChromaDB (persistente)
- [ ] Retrieval semântico por cosine similarity no ChromaDB (top-3 chunks)
- [ ] Construção do prompt RAG com contexto recuperado
- [ ] Geração de resposta via Ollama phi3 (local)
- [ ] Interface de chat com histórico da conversa
- [ ] Visualização do FAQ carregado (renderizado em Markdown)
- [ ] Troca da base de conhecimento via novo upload
- [ ] Resposta explícita para perguntas fora do FAQ

---

## 10. Funcionalidades Opcionais

- [ ] Persistência via ChromaDB (evita re-indexar após restart — comportamento padrão)
- [ ] Exibir quais chunks foram recuperados (modo transparência para pesquisa)
- [ ] Score de similaridade visível (modo debug para o artigo)
- [ ] Indicador de loading durante indexação e geração
- [ ] Contador de perguntas respondidas (métrica automática)
- [ ] Export de log de conversas em JSON/CSV (para análise no artigo)
- [ ] Avaliação 1-5 por resposta (CSAT embutido)
- [ ] Suporte a headings `###` além de `##` no chunking

---

## 11. Plano de Implementação

### Etapa 1 — Infraestrutura RAG (2–3h)

1. Instalar dependências: `npm install @huggingface/transformers chromadb react-markdown`
2. Criar `.env.local` com `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `CHROMA_URL`
3. Criar `src/lib/embeddings.ts` — `generateEmbedding(text)` via `all-MiniLM-L6-v2` (ONNX)
4. Criar `src/lib/llm.ts` — `generateAnswer(prompt)` via Ollama HTTP API
5. Criar `src/lib/rag.ts` — funções `parseMarkdownToChunks(md)`, `cosineSimilarity(a, b)` e `retrieveTopK(query, k)`
6. Criar `src/lib/store.ts` — singleton ChromaDB com métodos async `set`, `getStatus`, `clear`, `query`
7. Criar `src/types/index.ts`

### Etapa 2 — API Routes (2–3h)

7. Criar `src/app/api/faq/upload/route.ts` — recebe FormData, chama pipeline de indexação, retorna status
8. Criar `src/app/api/faq/route.ts` — lê `current-faq.md`, retorna conteúdo e status
9. Criar `src/app/api/chat/route.ts` — retrieval (ChromaDB) + montagem do prompt + chamada Ollama phi3

### Etapa 3 — UI (3–4h)

10. Criar `FAQUpload.tsx` — input de arquivo, botão de upload, feedback de indexação (chunk count)
11. Criar `FAQViewer.tsx` — renderiza FAQ com `react-markdown`, colapsável
12. Criar `ChatInterface.tsx` — lista de mensagens, input, botão enviar, scroll automático
13. Atualizar `page.tsx` — layout de 2 colunas: upload+viewer | chat

### Etapa 4 — Integração e Testes (2h)

14. Testar pipeline completo: upload → indexação → pergunta → resposta
15. Testar troca de FAQ durante sessão
16. Testar pergunta fora do FAQ
17. Verificar que o prompt RAG está sendo construído corretamente (log no console)

### Etapa 5 — Polish (1–2h)

18. Loading spinner durante indexação e geração
19. Mensagens de erro amigáveis (API key inválida, arquivo não suportado)
20. Estilização final com Tailwind

---

## 12. Cronograma Estimado

| Etapa | Descrição | Horas |
|---|---|---|
| 1 | Infraestrutura RAG (lib/) | 2–3h |
| 2 | API Routes | 2–3h |
| 3 | UI (componentes + page) | 3–4h |
| 4 | Integração e testes | 2h |
| 5 | Polish e demo prep | 1–2h |
| **Total** | | **10–14h** |

---

## 13. Riscos Técnicos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| ChromaDB fora do ar ao iniciar | Média | Alto | Docker Compose `depends_on` garante ordem de subida; retry na conexão |
| Ollama sem o modelo phi3 baixado | Alta | Alto | `make docker-setup` executa `ollama pull phi3` automaticamente |
| Download do modelo all-MiniLM-L6-v2 na primeira execução | Baixa | Baixo | Volume `hf-cache` persiste o cache; ~90 MB, baixado uma única vez |
| ONNX binários incompatíveis com alpine | Alta | Alto | Dockerfile usa `node:20-slim` (glibc); não usar `node:20-alpine` |
| Qualidade de retrieval baixa para perguntas muito curtas | Média | Alto | Testar com K=3 e K=5; checar chunks recuperados no log |
| phi3 lento em CPU (sem GPU) | Média | Baixo | Aceitável para demo do TCC; documentado como limitação |
| Arquivo FAQ mal formatado | Média | Médio | Validar que o arquivo tem pelo menos um heading `##` antes de indexar |

---

## 14. Estratégia de Avaliação para o Artigo

### Métricas Quantitativas

| Métrica | Como Medir |
|---|---|
| **Tempo de resolução** | Cronometrar: usuário sem chatbot (busca manual no PDF/Doc) vs. com chatbot |
| **Taxa de resolução** | % de perguntas onde a resposta estava correta e completa |
| **Precisão do retrieval** | Pesquisadora verifica manualmente se os top-3 chunks eram relevantes para a pergunta |
| **Número de turnos por sessão** | Média de mensagens trocadas até o usuário obter a resposta |

### Métricas Qualitativas

| Instrumento | Detalhes |
|---|---|
| **SUS (System Usability Scale)** | Questionário padronizado, 10 questões, escala 1-5, resultado 0-100. Referência bibliográfica consolidada |
| **CSAT por resposta** | Botão 👍/👎 ou nota 1-5 após cada resposta do chatbot (opcional, +30min de implementação) |

### Protocolo de Teste Sugerido

1. Recrutar **5–10 participantes** (desenvolvedores juniores ou alunos)
2. Fornecer o mesmo arquivo FAQ.md a todos
3. Aplicar **5 perguntas padronizadas** (cobrindo diferentes seções do FAQ)
4. **Grupo A:** busca manual no documento de FAQ → medir tempo
5. **Grupo B (ou mesmos participantes):** usar OnboardBot → medir tempo
6. Registrar tempo de cada resposta em planilha
7. Aplicar questionário SUS ao final
8. Análise: média, mediana e comparação entre grupos

### Métricas de Qualidade do RAG

| Métrica | Como Medir |
|---|---|
| **Relevância dos chunks** | Para cada pergunta, verificar manualmente se os top-3 chunks retornados eram os mais relevantes |
| **MRR (Mean Reciprocal Rank)** | Para cada pergunta, registrar em qual posição do ranking estava o chunk correto; calcular média de 1/rank |

---

## 15. Diagrama Textual da Solução

```
┌─────────────────────────────────────────────────────────────────┐
│                      NAVEGADOR (Frontend)                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   FAQUpload     │  │   FAQViewer     │  │ ChatInterface  │  │
│  │  (drag & drop)  │  │ (react-markdown)│  │  + 👍👎 feedback│  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                    │           │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │ POST /api/faq      │ GET /api/faq        │ POST /api/chat
            │ /upload            │                     │
┌───────────▼────────────────────▼─────────────────────▼───────────┐
│                     SERVIDOR (Next.js)                            │
│                                                                   │
│  ┌──────────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  /api/faq/upload │  │  /api/faq   │  │     /api/chat        │ │
│  │                  │  │             │  │                       │ │
│  │  1. Lê arquivo   │  │  Retorna    │  │  1. Embed pergunta    │ │
│  │  2. Parse chunks │  │  current-   │  │     (ONNX em Node)   │ │
│  │  3. Gera         │  │  faq.md     │  │  2. ChromaDB query   │ │
│  │     embeddings   │  │             │  │  3. Top-K chunks      │ │
│  │     (ONNX)       │  │             │  │  4. Monta prompt RAG  │ │
│  │  4. Persiste no  │  │             │  │  5. Ollama phi3       │ │
│  │     ChromaDB     │  │             │  │  6. Retorna resposta  │ │
│  └────────┬─────────┘  └─────────────┘  └──────────┬───────────┘ │
│           │                                          │             │
│  ┌────────▼──────────────────────────────────────────▼───────────┐ │
│  │                    lib/ (lógica RAG)                          │ │
│  │                                                               │ │
│  │  embeddings.ts      rag.ts              store.ts (ChromaDB)  │ │
│  │  ──────────────     ──────              ──────────────────── │ │
│  │  generateEmbedding  parseMarkdown       faqStore.set()        │ │
│  │  (all-MiniLM-L6)    cosineSimilarity    faqStore.query()      │ │
│  │                     retrieveTopK        faqStore.getStatus()  │ │
│  │  llm.ts                                                       │ │
│  │  ──────                                                       │ │
│  │  generateAnswer (→ Ollama)                                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
            │ :11434                              │ :8000
┌───────────▼──────────────┐       ┌──────────────▼──────────────┐
│    Ollama (Docker)        │       │   ChromaDB (Docker)          │
│                           │       │                              │
│  phi3                     │       │  coleção: faq-embeddings     │
│  (gera respostas)         │       │  hnsw:space=cosine           │
│                           │       │  (persiste em volume)        │
└───────────────────────────┘       └──────────────────────────────┘

                    ┌──────────────────────────────┐
                    │    uploads/ (disco local)    │
                    │                              │
                    │  current-faq.md              │
                    │  metrics.json                │
                    └──────────────────────────────┘
```

---

## 16. Arquitetura Final Recomendada

### Resumo

> **Next.js full-stack + Ollama phi3 (LLM local) + all-MiniLM-L6-v2 (ONNX embeddings) + ChromaDB (vector store) + Docker Compose**

### Justificativas das Escolhas

**Next.js como full-stack único:**
O projeto já está scaffolded com Next.js. Os Route Handlers eliminam a necessidade de um servidor separado. Para um MVP acadêmico com uma única desenvolvedora, manter tudo em um repositório é a decisão correta — sem contexto de troca entre serviços, sem deploy duplo.

**Stack 100% local (Ollama + HuggingFace Transformers + ChromaDB):**
Zero custo, zero dependência de APIs externas, reprodutível por qualquer avaliador sem chave de API. O modelo `all-MiniLM-L6-v2` roda dentro do processo Node.js via ONNX (sem microserviço adicional), e o Ollama phi3 executa localmente via Docker. Decisão alinhada com os ADRs 2, 3 e 4.

**RAG manual sem LangChain:**
LangChain.js, apesar de bem documentado, introduz uma camada de abstração que obscurece o pipeline para o artigo científico. Implementar chunking, embedding e retrieval manualmente permite explicar cada etapa com clareza no texto acadêmico — ponto positivo para a pesquisa.

**ChromaDB como vector store:**
Persiste embeddings entre restarts sem reindexação. A busca vetorial com `hnsw:space: cosine` é nativa e eficiente. Para FAQs de onboarding (< 100 perguntas), a diferença de performance em relação a busca linear é irrelevante, mas a persistência elimina a necessidade de reindexar a cada restart do servidor.

**Sem banco de dados relacional:**
O FAQ é um arquivo de texto. As métricas são um arquivo JSON append-only. Não há usuários, sessões persistentes ou dados relacionais que justifiquem PostgreSQL ou SQLite.

### Trade-offs Aceitos

| Decisão | Trade-off Aceito |
|---|---|
| phi3 (modelo compacto) | Respostas menos elaboradas que modelos maiores → aceitável para FAQ estruturado |
| Ollama em CPU | Latência maior (~5–30s) → aceitável para demo acadêmica sem GPU |
| ChromaDB via Docker | Requer Docker instalado → documentado como pré-requisito |
| Sem autenticação | Qualquer pessoa com acesso à URL pode usar o sistema → aceitável para demo acadêmico |
| K=3 chunks fixo | Pode não recuperar contexto suficiente para perguntas complexas → ajustável via `RAG_TOP_K` |
| Chunking por `##` apenas | FAQs com `###` ou sem headings não são parseadas → tratar como limitação no artigo |

---

## 17. Roadmap de Implementação

```
Semana 1
  ├── Dia 1 (2-3h): Etapa 1 — Infraestrutura RAG (lib/)
  ├── Dia 2 (2-3h): Etapa 2 — API Routes
  └── Dia 3 (3-4h): Etapa 3 — UI Base

Semana 2
  ├── Dia 4 (2h):   Etapa 4 — Integração e testes
  └── Dia 5 (1-2h): Etapa 5 — Polish e preparação da demo

Total estimado: 10–14 horas de desenvolvimento
```

---

## 18. Checklist de Entrega do TCC

### Protótipo Funcional

- [ ] Projeto roda localmente com `npm run dev`
- [ ] Upload de FAQ em Markdown funciona
- [ ] FAQ é visualizada renderizada no sistema
- [ ] Pipeline RAG completo funciona (upload → indexação → chat → resposta)
- [ ] Respostas são geradas apenas com base no FAQ carregado
- [ ] Perguntas fora do FAQ recebem resposta negativa explícita
- [ ] Troca de FAQ via novo upload funciona

### Artigo Científico

- [ ] Descrição do problema (onboarding de desenvolvedores)
- [ ] Revisão bibliográfica sobre chatbots FAQ e RAG
- [ ] Descrição da arquitetura e decisões de design
- [ ] Protocolo de avaliação definido (SUS + tempo de resolução)
- [ ] Experimento realizado com participantes reais (mínimo 5)
- [ ] Resultados analisados e discutidos
- [ ] Limitações e trabalhos futuros documentados

### Critérios de Qualidade do Protótipo

- [ ] Tempo de resposta < 5 segundos para perguntas simples
- [ ] Interface utilizável sem instruções prévias
- [ ] Sistema se recupera de erros comuns (arquivo inválido, API indisponível)
- [ ] Código organizado e comentado para revisão acadêmica

---

## 19. Lista de Bibliotecas Exatas

```json
{
  "dependencies": {
    "next": "^16.2.7",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "@huggingface/transformers": "^3.x",
    "chromadb": "^1.x",
    "react-markdown": "^9.0.1"
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/node": "^20",
    "eslint": "^9",
    "eslint-config-next": "^16.2.7",
    "vitest": "^3.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

**Sem API key. Sem LangChain. Sem banco relacional. Stack 100% local via Docker Compose.**

---

---

## 20. Observabilidade e Métricas Acadêmicas

> Incremento implementado na Etapa 6 do roadmap. Sem banco de dados — persistência via `uploads/metrics.json`.

### 20.1 Objetivo

Coletar automaticamente os dados necessários para validar as hipóteses da pesquisa nas três dimensões:

| Dimensão | O que mede |
|---|---|
| **Eficiência** | Velocidade do sistema e da interação |
| **Efetividade** | Capacidade de resolver dúvidas |
| **Satisfação** | Percepção do usuário sobre a ferramenta |

### 20.2 O que é coletado (e o que não é)

**Coletado:**
- Tempos de resposta (retrieval, geração, total) por mensagem
- Feedback 👍/👎 por resposta do assistente
- Contagem de mensagens por sessão
- Resposta à pergunta "Sua dúvida foi resolvida?" ao encerrar
- Nota de satisfação 1–5 ao encerrar (opcional)

**Não coletado:**
- Conteúdo das mensagens (privacidade dos participantes)
- Identificação do usuário
- Histórico completo da conversa

### 20.3 Fluxo de coleta

```
[Início da sessão]
  sessionId gerado no cliente (crypto.randomUUID())
  startedAt registrado

[Cada resposta do assistente]
  POST /api/chat retorna: answer + retrievedChunks + timing
  Botões 👍 👎 exibidos abaixo da mensagem
  Ao clicar: POST /api/metrics/feedback → gravado em metrics.json

[Encerramento — botão "Encerrar conversa"]
  Modal: "Sua dúvida foi resolvida?" + avaliação 1–5 (opcional)
  POST /api/metrics/session → gravado em metrics.json
  Histórico do chat limpo (nova sessão possível)

[Dashboard /dashboard]
  GET /api/metrics → lê metrics.json → calcula agregados → retorna JSON
  MetricsDashboard.tsx exibe cards + tabela
```

### 20.4 Métricas calculadas em `GET /api/metrics`

**Eficiência:**

| Métrica | Cálculo |
|---|---|
| Tempo médio de resposta | `mean(timings[*].totalTimeMs)` |
| Tempo médio de retrieval | `mean(timings[*].retrievalTimeMs)` |
| Tempo médio de geração | `mean(timings[*].generationTimeMs)` |
| Média de mensagens por sessão | `mean(sessions[*].userMessageCount)` |

**Efetividade:**

| Métrica | Cálculo |
|---|---|
| Taxa de resolução | `sessions com resolved=true` / `sessions com resolved definido` × 100 |
| Taxa de feedback positivo | `feedbacks com value='positive'` / `total feedbacks` × 100 |
| Taxa de feedback negativo | 100 − taxa positiva |
| Cobertura de feedback | `sessões com ≥1 feedback` / `total sessões` × 100 |

**Satisfação:**

| Métrica | Cálculo |
|---|---|
| Nota média de satisfação | `mean(sessions[*].satisfactionScore)` (onde definido) |
| Taxa de preenchimento do survey | `sessions com satisfactionScore` / `total sessions` × 100 |

### 20.5 Persistência

```
uploads/metrics.json
{
  "feedbacks": [ ...MessageFeedback[] ],
  "timings":   [ ...ResponseTiming[]  ],
  "sessions":  [ ...SessionSummary[]  ]
}
```

- Arquivo criado automaticamente na primeira interação
- Append-only: cada evento é adicionado ao array correspondente
- Tamanho estimado: ~200 bytes por sessão — adequado para 500+ sessões de pesquisa
- Gitignored (junto com `current-faq.md`)

### 20.6 Novo componente — `metrics-store.ts`

Singleton análogo ao `store.ts`, responsável por:
- Carregar `metrics.json` do disco na primeira leitura
- Fornecer métodos `appendFeedback`, `appendTiming`, `appendSession`
- Persistir cada append imediatamente (write-through, sem buffer)
- Retornar os dados brutos para que a route handler calcule os agregados

### 20.7 Dashboard `/dashboard`

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Total sessões  │  Msgs/sessão    │  Tempo resposta  │
│      12         │     4.2         │    2.3s          │
├─────────────────┼─────────────────┼─────────────────┤
│  Taxa resolução │  Feedback +     │  Satisfação      │
│     78%         │    83%          │   4.1/5          │
└─────────────────┴─────────────────┴─────────────────┘

Sessões recentes:
ID    │ Data       │ Msgs │ Resolvida │ Satisfação │ Feedbacks
──────┼────────────┼──────┼───────────┼────────────┼──────────
a3f1  │ 2026-06-08 │  5   │ Sim       │ ★★★★☆      │ 2 👍 0 👎
```

Acesso via link "Métricas" no header da aplicação principal.

---

*Documento gerado em 2026-06-01 para o TCC de OnboardBot. Seção 20 adicionada em 2026-06-08. Stack atualizada para Ollama + HuggingFace Transformers + ChromaDB em 2026-07-24.*
