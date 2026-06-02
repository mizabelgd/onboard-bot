import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMarkdownToChunks, cosineSimilarity, retrieveTopK } from '@/lib/rag'
import type { FAQChunk } from '@/types'

vi.mock('@/lib/gemini', () => ({
  generateEmbedding: vi.fn(),
}))

import { generateEmbedding } from '@/lib/gemini'
const mockEmbed = vi.mocked(generateEmbedding)

// ---------------------------------------------------------------------------
// parseMarkdownToChunks
// ---------------------------------------------------------------------------

describe('parseMarkdownToChunks', () => {
  it('retorna array vazio para string vazia', () => {
    expect(parseMarkdownToChunks('')).toEqual([])
  })

  it('retorna array vazio quando não há headings ##', () => {
    expect(parseMarkdownToChunks('Apenas texto sem headings.')).toEqual([])
  })

  it('ignora heading ## sem conteúdo abaixo', () => {
    const md = '## Heading sem conteúdo\n\n## Outro heading\n\nConteúdo aqui.'
    const chunks = parseMarkdownToChunks(md)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBe('Outro heading')
  })

  it('parseia corretamente um FAQ com múltiplos headings', () => {
    const md = `## Como solicitar acesso ao Git?

Abra um chamado no Jira.

## Como configurar o ambiente local?

Execute npm install e configure o .env.local.`

    const chunks = parseMarkdownToChunks(md)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].heading).toBe('Como solicitar acesso ao Git?')
    expect(chunks[0].text).toContain('Abra um chamado no Jira.')
    expect(chunks[1].heading).toBe('Como configurar o ambiente local?')
    expect(chunks[1].text).toContain('npm install')
  })

  it('o campo text inclui o heading e o conteúdo', () => {
    const md = '## Minha Pergunta\n\nMinha resposta detalhada.'
    const [chunk] = parseMarkdownToChunks(md)
    expect(chunk.text).toBe('Minha Pergunta\n\nMinha resposta detalhada.')
  })

  it('ignora conteúdo antes do primeiro heading ##', () => {
    const md = `# Título do documento

Introdução sem heading ##.

## Primeira Seção

Conteúdo da seção.`

    const chunks = parseMarkdownToChunks(md)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBe('Primeira Seção')
  })
})

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('retorna 1 para vetores idênticos', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('retorna 0 para vetores ortogonais', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0)
  })

  it('retorna 0 quando um dos vetores é zero', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0)
  })

  it('retorna valor correto para vetores conhecidos', () => {
    // cos([1,0], [1,1]) = 1 / (1 * sqrt(2)) ≈ 0.707
    expect(cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(0.707, 2)
  })

  it('retorna -1 para vetores opostos', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })
})

// ---------------------------------------------------------------------------
// retrieveTopK
// ---------------------------------------------------------------------------

describe('retrieveTopK', () => {
  const makeChunk = (heading: string, embedding: number[]): FAQChunk => ({
    heading,
    text: `${heading}\n\nConteúdo.`,
    embedding,
  })

  beforeEach(() => {
    mockEmbed.mockReset()
  })

  it('retorna array vazio quando o store está vazio', async () => {
    const result = await retrieveTopK('qualquer pergunta', [], 3)
    expect(result).toEqual([])
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it('retorna os k chunks mais similares ordenados por score', async () => {
    const store = [
      makeChunk('Irrelevante', [0, 1, 0]),   // similaridade baixa com a query
      makeChunk('Alvo',        [1, 0, 0]),   // similaridade alta com a query
      makeChunk('Mediano',     [0.5, 0.5, 0]), // similaridade média
    ]
    // Query similar ao chunk "Alvo"
    mockEmbed.mockResolvedValue([1, 0, 0])

    const result = await retrieveTopK('pergunta', store, 2)

    expect(result).toHaveLength(2)
    expect(result[0].heading).toBe('Alvo')
  })

  it('retorna todos quando k é maior que o número de chunks', async () => {
    const store = [makeChunk('A', [1, 0]), makeChunk('B', [0, 1])]
    mockEmbed.mockResolvedValue([1, 0])

    const result = await retrieveTopK('pergunta', store, 10)
    expect(result).toHaveLength(2)
  })

  it('gera embedding da query exatamente uma vez', async () => {
    const store = [makeChunk('A', [1, 0])]
    mockEmbed.mockResolvedValue([1, 0])

    await retrieveTopK('pergunta', store, 1)
    expect(mockEmbed).toHaveBeenCalledTimes(1)
    expect(mockEmbed).toHaveBeenCalledWith('pergunta')
  })
})
