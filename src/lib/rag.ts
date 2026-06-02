import { generateEmbedding } from './gemini'
import type { FAQChunk } from '../types'

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
