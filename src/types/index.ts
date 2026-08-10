export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  isError?: boolean
  metricId?: string  // ID do servidor para vincular ao feedback
}

export interface FAQChunk {
  heading: string
  text: string       // heading + content concatenados — vai no prompt
  embedding: number[] // 384 dimensões — all-MiniLM-L6-v2
}

export interface FAQStatus {
  loaded: boolean
  filename?: string
  indexedAt?: string
  chunkCount?: number
}

export interface ChatRequest {
  message: string
  history: Message[]
  sessionId?: string
}

export interface ChatResponse {
  answer: string
  retrievedChunks: string[]
  timing?: {
    messageId: string
    retrievalTimeMs: number
    generationTimeMs: number
    totalTimeMs: number
  }
}

export interface MessageFeedback {
  messageId: string
  sessionId: string
  value: 'positive' | 'negative'
  timestamp: string
}

export interface ResponseTiming {
  messageId: string
  sessionId: string
  retrievalTimeMs: number
  generationTimeMs: number
  totalTimeMs: number
  timestamp: string
  // Campos ADR 8 — enriquecimento para cálculo de métricas de qualidade RAG
  question?: string
  answer?: string
  similarityScores?: number[]         // cosine similarity por chunk recuperado (0–1)
  retrievedChunkHeadings?: string[]
  retrievalFailed?: boolean           // true se avg(scores) < SIMILARITY_THRESHOLD
  contextUtilized?: boolean           // heurística de overlap tokens answer↔context
  // Instrumentação granular do pipeline (análise de desempenho)
  embeddingTimeMs?: number            // geração do embedding da query
  vectorSearchTimeMs?: number         // busca vetorial no ChromaDB
  contextBuildTimeMs?: number         // montagem do texto de contexto
  promptBuildTimeMs?: number          // montagem do prompt final
  timeToFirstTokenMs?: number         // latência até o primeiro token do Ollama
  ollamaLoadDurationMs?: number       // tempo de carregamento do modelo (relatado pelo Ollama)
  ollamaPromptEvalDurationMs?: number // tempo de prefill do prompt (relatado pelo Ollama)
  ollamaEvalDurationMs?: number       // tempo de geração pura (relatado pelo Ollama)
  ollamaEvalCount?: number            // tokens gerados (relatado pelo Ollama)
}

export interface SessionSummary {
  sessionId: string
  startedAt: string
  endedAt: string
  userMessageCount: number
  resolved?: boolean
  satisfactionScore?: 1 | 2 | 3 | 4 | 5
}

export interface MetricsFile {
  feedbacks: MessageFeedback[]
  timings: ResponseTiming[]
  sessions: SessionSummary[]
}

export interface UploadResponse {
  success: boolean
  chunkCount: number
  filename: string
}
