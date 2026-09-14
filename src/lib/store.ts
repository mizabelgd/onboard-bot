import { ChromaClient, type Collection } from 'chromadb'
import type { FAQChunk, FAQStatus } from '../types'

const CHROMA_URL = process.env.CHROMA_URL ?? 'http://localhost:8000'
const COLLECTION_NAME = 'faq-embeddings'

// Embedding function no-op: todos os embeddings são fornecidos explicitamente
// pelo @huggingface/transformers. Esta função nunca é chamada pelo ChromaDB,
// mas é exigida pela API para que a coleção não tente usar DefaultEmbeddingFunction.
const noOpEmbeddingFunction = {
  generate: async (_texts: string[]) => _texts.map(() => [] as number[]),
}

// Singleton que sobrevive ao HMR do Next.js em desenvolvimento
const g = globalThis as typeof globalThis & {
  __chromaClient: ChromaClient | null
  __chromaCollection: Collection | null
}

if (g.__chromaClient === undefined) {
  g.__chromaClient = null
  g.__chromaCollection = null
}

/**
 * Retorna (ou inicializa) a coleção ChromaDB com espaço de cosseno.
 * O espaço de distância é definido na criação e não pode ser alterado depois —
 * o volume do Docker garante persistência entre reinicializações.
 */
async function getCollection(): Promise<Collection> {
  if (!g.__chromaClient) {
    const url = new URL(CHROMA_URL)
    g.__chromaClient = new ChromaClient({
      host: url.hostname,
      port: parseInt(url.port || '8000'),
      ssl: url.protocol === 'https:',
    })
  }
  if (!g.__chromaCollection) {
    g.__chromaCollection = await g.__chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 'hnsw:space': 'cosine' },
      embeddingFunction: noOpEmbeddingFunction,
    })
  }
  return g.__chromaCollection
}

/**
 * Store da FAQ baseado em ChromaDB.
 * Substitui o store in-memory anterior — os embeddings são persistidos pelo ChromaDB
 * e sobrevivem a reinicializações do servidor sem re-indexação.
 */
export const faqStore = {
  /**
   * Substitui o índice inteiro: remove todos os vetores existentes e insere os novos.
   * Os metadados filename e indexedAt são armazenados em cada documento.
   */
  async set(chunks: FAQChunk[], filename: string): Promise<void> {
    const col = await getCollection()
    const indexedAt = new Date().toISOString()

    // Remove tudo antes de inserir para garantir índice limpo
    const existing = await col.get()
    if (existing.ids.length > 0) {
      await col.delete({ ids: existing.ids })
    }

    const ids = chunks.map((_, i) => `chunk_${i}`)
    const embeddings = chunks.map((c) => c.embedding)
    const documents = chunks.map((c) => c.text)
    const metadatas = chunks.map((c) => ({ heading: c.heading, filename, indexedAt }))

    await col.add({ ids, embeddings, documents, metadatas })
  },

  /**
   * Retorna metadados da FAQ ativa (filename, indexedAt, chunkCount).
   * Se a coleção estiver vazia, retorna { loaded: false }.
   */
  async getStatus(): Promise<FAQStatus> {
    try {
      const col = await getCollection()
      const count = await col.count()
      if (count === 0) return { loaded: false }

      const sample = await col.get({ limit: 1 })
      const meta = sample.metadatas?.[0] as { heading: string; filename: string; indexedAt: string } | undefined

      return {
        loaded: true,
        filename: meta?.filename,
        indexedAt: meta?.indexedAt,
        chunkCount: count,
      }
    } catch {
      return { loaded: false }
    }
  },

  /**
   * Remove todos os documentos da coleção e reseta o singleton.
   */
  async clear(): Promise<void> {
    try {
      const col = await getCollection()
      const all = await col.get()
      if (all.ids.length > 0) {
        await col.delete({ ids: all.ids })
      }
    } catch {
      // ignora se a coleção ainda não existir
    }
    // força re-obtenção da coleção na próxima chamada
    g.__chromaCollection = null
  },

  /**
   * Consulta os k chunks mais similares ao embedding fornecido.
   * A similaridade de cosseno é calculada pelo ChromaDB (configurado na criação da coleção).
   *
   * @param queryEmbedding Vetor de 384 dimensões da pergunta.
   * @param k Número de resultados a retornar.
   */
  async query(
    queryEmbedding: number[],
    k: number
  ): Promise<Array<{ heading: string; text: string; score: number }>> {
    const col = await getCollection()
    const results = await col.query({
      queryEmbeddings: [queryEmbedding],
      nResults: k,
    })

    const metadatas = results.metadatas[0] as Array<{ heading: string } | null>
    const documents = results.documents[0]
    // ChromaDB cosine space: distance = 1 - cosine_similarity → score = 1 - distance
    const distances = results.distances?.[0] ?? []

    return metadatas.map((meta, i) => ({
      heading: meta?.heading ?? '',
      text: documents[i] ?? '',
      score: distances[i] != null ? 1 - distances[i] : 0,
    }))
  },
}
