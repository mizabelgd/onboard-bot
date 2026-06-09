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
  embedding: number[] // 768 dimensões do text-embedding-004
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
