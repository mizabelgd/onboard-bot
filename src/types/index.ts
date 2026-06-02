export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
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
}

export interface ChatResponse {
  answer: string
  retrievedChunks: string[]
}

export interface UploadResponse {
  success: boolean
  chunkCount: number
  filename: string
}
