import { generateEmbedding } from './embeddings'
import { faqStore } from './store'
import type { FAQChunk } from '../types'

// Teto de tamanho por chunk. Seções de FAQ maiores que isso são sub-divididas
// por parágrafo para não inflar o prompt enviado ao LLM com um único bloco
// gigante quando apenas parte dele é relevante à pergunta.
const MAX_CHUNK_CHARS = 1000

/**
 * Agrupa parágrafos (separados por linha em branco) em blocos de até
 * `maxChars`. Um único parágrafo maior que `maxChars` não é quebrado no meio
 * da frase — vira um bloco próprio mesmo excedendo o teto.
 */
function splitLongContent(content: string, maxChars: number): string[] {
  const paragraphs = content.split(/\n\n+/)
  const groups: string[] = []
  let current = ''

  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p
    if (candidate.length > maxChars && current) {
      groups.push(current)
      current = p
    } else {
      current = candidate
    }
  }
  if (current) groups.push(current)

  return groups
}

/**
 * Divide um Markdown de FAQ em chunks por heading ##.
 * Cada chunk contém o heading e o conteúdo abaixo dele concatenados em `text`,
 * que é o campo enviado ao modelo de embedding e ao prompt RAG.
 * Seções sem conteúdo ou sem heading válido são ignoradas.
 * Seções com conteúdo maior que MAX_CHUNK_CHARS são sub-divididas por
 * parágrafo, mantendo o mesmo heading em cada sub-chunk.
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

    if (heading.length + content.length + 2 <= MAX_CHUNK_CHARS) {
      chunks.push({ heading, text: `${heading}\n\n${content}` })
      continue
    }

    for (const part of splitLongContent(content, MAX_CHUNK_CHARS)) {
      chunks.push({ heading, text: `${heading}\n\n${part}` })
    }
  }

  return chunks
}

/**
 * Calcula a similaridade de cosseno entre dois vetores de embedding.
 * Retorna valores entre -1 (opostos) e 1 (idênticos); retorna 0 se algum vetor for nulo.
 * Mantido para uso em avaliações e testes — o retrieval em produção usa o ChromaDB.
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
 * Recupera os k chunks mais relevantes para a query usando ChromaDB.
 * Gera o embedding da query via all-MiniLM-L6-v2 e delega a busca por
 * similaridade de cosseno ao ChromaDB.
 *
 * @param query Pergunta do usuário em texto livre.
 * @param k     Número de chunks a retornar (recomendado: 3).
 */
export async function retrieveTopK(
  query: string,
  k: number
): Promise<Array<{ heading: string; text: string; score: number }>> {
  const queryEmbedding = await generateEmbedding(query)
  return faqStore.query(queryEmbedding, k)
}
