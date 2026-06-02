import type { FAQChunk, FAQStatus } from '../types'

interface StoreState {
  chunks: FAQChunk[]
  filename: string
  indexedAt: string
}

// Persiste no globalThis para sobreviver ao HMR do Next.js em desenvolvimento
const g = globalThis as typeof globalThis & { __faqStore: StoreState | null }

if (g.__faqStore === undefined) {
  g.__faqStore = null
}

/**
 * Singleton do vector store em memória.
 * Mantém os chunks indexados da FAQ ativa durante o ciclo de vida do servidor.
 * Um novo upload substitui completamente o estado anterior via `set`.
 */
export const faqStore = {
  /** Substitui o índice inteiro com os novos chunks e registra metadados. */
  set(chunks: FAQChunk[], filename: string): void {
    g.__faqStore = { chunks, filename, indexedAt: new Date().toISOString() }
  },

  /** Retorna os chunks indexados, ou array vazio se nenhuma FAQ foi carregada. */
  get(): FAQChunk[] {
    return g.__faqStore?.chunks ?? []
  },

  /** Retorna metadados da FAQ ativa (filename, indexedAt, chunkCount). */
  getStatus(): FAQStatus {
    if (!g.__faqStore) return { loaded: false }
    return {
      loaded: true,
      filename: g.__faqStore.filename,
      indexedAt: g.__faqStore.indexedAt,
      chunkCount: g.__faqStore.chunks.length,
    }
  },

  /** Remove a FAQ ativa do store. */
  clear(): void {
    g.__faqStore = null
  },
}
