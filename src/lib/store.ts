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

export const faqStore = {
  set(chunks: FAQChunk[], filename: string): void {
    g.__faqStore = { chunks, filename, indexedAt: new Date().toISOString() }
  },

  get(): FAQChunk[] {
    return g.__faqStore?.chunks ?? []
  },

  getStatus(): FAQStatus {
    if (!g.__faqStore) return { loaded: false }
    return {
      loaded: true,
      filename: g.__faqStore.filename,
      indexedAt: g.__faqStore.indexedAt,
      chunkCount: g.__faqStore.chunks.length,
    }
  },

  clear(): void {
    g.__faqStore = null
  },
}
