import { NextRequest } from 'next/server'
import { faqStore } from '@/lib/store'
import { metricsStore } from '@/lib/metrics-store'
import { generateEmbedding } from '@/lib/embeddings'
import { generateAnswerStream, type OllamaMessage } from '@/lib/llm'
import { logPipelineTimings } from '@/lib/perf-logger'
import type { ChatRequest, Message, ResponseTiming } from '@/types'

const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT ?? '6', 10)
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K ?? '3', 10)
// Limiar de similaridade cosine abaixo do qual o retrieval é considerado falho (ADR 7)
const SIMILARITY_THRESHOLD = 0.30

const PT_STOP_WORDS = new Set([
  'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
  'se','na','por','mais','as','dos','como','mas','ao','ele','das','seu',
  'sua','ou','quando','muito','nos','já','também','só','até','isso','esse',
  'esta','este','foi','são','tem','não','sim','ter','ser',
])

function computeContextOverlap(answer: string, contexts: string[]): boolean {
  const tokenize = (text: string) =>
    text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(
      (t) => t.length >= 3 && !PT_STOP_WORDS.has(t)
    )

  const answerTokens = new Set(tokenize(answer))
  if (answerTokens.size === 0) return false

  const contextTokens = new Set(contexts.flatMap(tokenize))
  let overlap = 0
  for (const t of answerTokens) {
    if (contextTokens.has(t)) overlap++
  }
  return overlap / answerTokens.size >= 0.20
}

/**
 * Instrução de sistema do OnboardBot — enxuta para reduzir tokens de prefill
 * em toda requisição, mantendo o mesmo comportamento (conversa natural,
 * pedido de esclarecimento em pergunta genérica, resposta só com base no
 * contexto).
 */
const SYSTEM_PROMPT = `Você é o OnboardBot, assistente de onboarding de desenvolvedores.

- Saudações e conversa geral: responda natural e breve, sem mencionar o FAQ.
- Pergunta técnica genérica demais (não diz qual ferramenta/erro/processo): peça UM esclarecimento específico, direto.
- Pergunta técnica específica: responda APENAS com base nos trechos de FAQ abaixo, sem conhecimento externo. Se a informação não estiver nos trechos, diga: "Não encontrei essa informação no FAQ atual. Por favor, consulte seu time ou supervisor."
- Não repita saudações ("Olá", "Oi") em toda resposta — cumprimente só se o usuário cumprimentar primeiro.

Seja direto e objetivo.`

// Teto de caracteres por mensagem do histórico incluída no prompt. Sem isso,
// respostas longas do próprio assistente se acumulam a cada turno e podem
// estourar o num_ctx do Ollama em conversas com várias perguntas.
const MAX_HISTORY_MESSAGE_CHARS = 400

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

function buildContextSection(chunks: { heading: string; text: string }[]): string {
  return chunks.map((chunk, i) => `[Trecho ${i + 1}]\n${chunk.text}`).join('\n\n')
}

/**
 * Monta as mensagens no formato de chat do Ollama (system + histórico real +
 * pergunta atual), em vez de um único prompt de texto com o histórico
 * "achatado" manualmente. Isso é importante: quando o histórico virava texto
 * dentro de um prompt único (`Usuário: ...\nAssistente: ...`), o modelo às
 * vezes continuava "inventando" o próximo turno da conversa em vez de parar
 * na resposta atual. Com turnos reais, o Ollama aplica o template de chat do
 * modelo e os tokens de parada nativos entre cada turno.
 */
function buildMessages(context: string, history: Message[], message: string): OllamaMessage[] {
  const recentHistory = history.slice(-HISTORY_LIMIT)
  return [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n[Contexto Recuperado]\n${context}` },
    ...recentHistory.map((m) => ({ role: m.role, content: truncate(m.content, MAX_HISTORY_MESSAGE_CHARS) })),
    { role: 'user' as const, content: message },
  ]
}

type StreamEvent =
  | { type: 'chunk'; text: string }
  | {
      type: 'done'
      messageId: string
      retrievedChunks: string[]
      timing: { messageId: string; retrievalTimeMs: number; generationTimeMs: number; totalTimeMs: number }
    }
  | { type: 'error'; error: string }

function ndjson(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + '\n')
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * POST /api/chat
 *
 * Executa o pipeline RAG completo para uma mensagem do usuário, em streaming:
 *   1. Valida a mensagem e o estado do store
 *   2. Gera o embedding da query e busca os top-k chunks no ChromaDB (com timing)
 *   3. Filtra chunks abaixo do limiar de similaridade e monta o prompt
 *   4. Transmite a resposta do Ollama token a token (NDJSON) e persiste métricas ao final
 *
 * @param request JSON { message, history, sessionId? }
 * @returns 200 stream NDJSON de linhas {type:"chunk"|"done"|"error", ...} | 400/500 { error }
 */
export async function POST(request: NextRequest) {
  const requestReceivedAt = Date.now()

  let body: ChatRequest
  try {
    body = (await request.json()) as ChatRequest
  } catch {
    return jsonError('Corpo da requisição inválido.', 400)
  }

  const { message, history = [], sessionId } = body

  if (!message?.trim()) {
    return jsonError('Mensagem não pode ser vazia.', 400)
  }

  const status = await faqStore.getStatus()
  if (!status.loaded) {
    return jsonError('Nenhuma FAQ carregada. Faça o upload de um arquivo .md primeiro.', 400)
  }

  const embeddingStart = Date.now()
  const queryEmbedding = await generateEmbedding(message)
  const embeddingTimeMs = Date.now() - embeddingStart

  const searchStart = Date.now()
  const topChunks = await faqStore.query(queryEmbedding, RAG_TOP_K)
  const vectorSearchTimeMs = Date.now() - searchStart

  // Só chunks com similaridade acima do limiar viram contexto — evita
  // injetar ruído irrelevante no prompt quando o match é fraco. Se nenhum
  // sobrar, o próprio system prompt instrui a resposta "não encontrei".
  const relevantChunks = topChunks.filter((c) => c.score >= SIMILARITY_THRESHOLD)

  const contextStart = Date.now()
  const context = buildContextSection(relevantChunks)
  const contextBuildTimeMs = Date.now() - contextStart

  const promptStart = Date.now()
  const messages: OllamaMessage[] = buildMessages(context, history, message)
  const promptBuildTimeMs = Date.now() - promptStart

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullAnswer = ''
      let firstTokenAt: number | null = null
      const generationStart = Date.now()

      try {
        const stats = await generateAnswerStream(messages, (piece) => {
          if (firstTokenAt === null) firstTokenAt = Date.now()
          fullAnswer += piece
          controller.enqueue(ndjson({ type: 'chunk', text: piece }))
        })

        const generationTimeMs = Date.now() - generationStart
        const timeToFirstTokenMs = (firstTokenAt ?? Date.now()) - generationStart
        const totalTimeMs = Date.now() - requestReceivedAt
        const retrievalTimeMs = embeddingTimeMs + vectorSearchTimeMs
        const messageId = crypto.randomUUID()

        logPipelineTimings(
          {
            Embedding: embeddingTimeMs,
            'Vector Search': vectorSearchTimeMs,
            'Context Builder': contextBuildTimeMs,
            'Prompt Builder': promptBuildTimeMs,
            'LLM Time-to-First-Token': timeToFirstTokenMs,
            'LLM Inference': generationTimeMs,
          },
          totalTimeMs
        )

        controller.enqueue(
          ndjson({
            type: 'done',
            messageId,
            retrievedChunks: relevantChunks.map((c) => c.heading),
            timing: { messageId, retrievalTimeMs, generationTimeMs, totalTimeMs },
          })
        )
        controller.close()

        if (sessionId) {
          const scores = relevantChunks.map((c) => c.score)
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
          const timing: ResponseTiming = {
            messageId,
            sessionId,
            retrievalTimeMs,
            generationTimeMs,
            totalTimeMs,
            timestamp: new Date().toISOString(),
            question: message,
            answer: fullAnswer,
            similarityScores: scores,
            retrievedChunkHeadings: relevantChunks.map((c) => c.heading),
            retrievalFailed: avgScore < SIMILARITY_THRESHOLD,
            contextUtilized: computeContextOverlap(fullAnswer, relevantChunks.map((c) => c.text)),
            embeddingTimeMs,
            vectorSearchTimeMs,
            contextBuildTimeMs,
            promptBuildTimeMs,
            timeToFirstTokenMs,
            ollamaLoadDurationMs: stats.loadDurationMs,
            ollamaPromptEvalDurationMs: stats.promptEvalDurationMs,
            ollamaEvalDurationMs: stats.evalDurationMs,
            ollamaEvalCount: stats.evalCount,
          }
          await metricsStore.appendTiming(timing).catch((err) =>
            console.error('[POST /api/chat] metrics write failed', err)
          )
        }
      } catch (error) {
        console.error('[POST /api/chat] stream error', error)
        controller.enqueue(ndjson({ type: 'error', error: 'Erro ao gerar resposta.' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
