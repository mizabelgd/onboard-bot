import { readFile } from 'fs/promises'
import { join } from 'path'
import type { FAQChunk, FAQStatus } from '../types'

interface StoreState {
  chunks: FAQChunk[]
  filename: string
  indexedAt: string
}

const INDEX_FILE = join(process.cwd(), 'uploads', 'index.json')

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

/**
 * Tenta carregar o índice do disco (uploads/index.json) se o store estiver vazio.
 * Chamada no início de cada request para recuperar o índice após restart do servidor,
 * evitando a necessidade de re-fazer o upload.
 */
export async function initStoreFromDisk(): Promise<void> {
  if (g.__faqStore !== null) return
  try {
    const raw = await readFile(INDEX_FILE, 'utf-8')
    const state = JSON.parse(raw) as StoreState
    g.__faqStore = state
  } catch {
    // index.json não existe ou está corrompido — store permanece vazio
  }
}
