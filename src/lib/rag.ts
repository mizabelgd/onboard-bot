import { generateEmbedding } from './gemini'
import type { FAQChunk } from '../types'

/**
 * Divide um Markdown de FAQ em chunks por heading ##.
 * Cada chunk contém o heading e o conteúdo abaixo dele concatenados em `text`,
 * que é o campo enviado ao modelo de embedding e ao prompt RAG.
 * Seções sem conteúdo ou sem heading válido são ignoradas.
 */
export function parseMarkdownToChunks(md: string): Omit<FAQChunk, 'embedding'>[] {
  const chunks: Omit<FAQChunk, 'embedding'>[] = []

  // Divide pelo início de cada heading ##, preservando o heading no trecho
  const sections = md.split(/\n(?=## )/)

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const headingLine = lines[0]

    if (!headingLine.startsWith('## ')) continue

    const heading = headingLine.replace(/^##\s+/, '').trim()
    const content = lines.slice(1).join('\n').trim()

    if (!heading || !content) continue

    chunks.push({ heading, text: `${heading}\n\n${content}` })
  }

  return chunks
}

/**
 * Calcula a similaridade de cosseno entre dois vetores de embedding.
 * Retorna valores entre -1 (opostos) e 1 (idênticos); retorna 0 se algum vetor for nulo.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/**
 * Recupera os k chunks mais relevantes para a query usando similaridade semântica.
 * Gera o embedding da query, compara com todos os chunks do store e retorna os top-k
 * ordenados por similaridade decrescente.
 *
 * @param query  Pergunta do usuário em texto livre.
 * @param store  Chunks indexados com embeddings pré-calculados.
 * @param k      Número de chunks a retornar (recomendado: 3).
 */
export async function retrieveTopK(
  query: string,
  store: FAQChunk[],
  k: number
): Promise<FAQChunk[]> {
  if (store.length === 0) return []

  const queryEmbedding = await generateEmbedding(query)

  return store
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk }) => chunk)
}
