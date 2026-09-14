import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMarkdownToChunks, cosineSimilarity, retrieveTopK } from '@/lib/rag'

// Mock dos módulos que retrieveTopK delega
vi.mock('@/lib/embeddings', () => ({ generateEmbedding: vi.fn() }))
vi.mock('@/lib/store', () => ({
  faqStore: { query: vi.fn(), set: vi.fn(), getStatus: vi.fn(), clear: vi.fn() },
}))

import { generateEmbedding } from '@/lib/embeddings'
import { faqStore } from '@/lib/store'

const mockEmbed = vi.mocked(generateEmbedding)
const mockQuery = vi.mocked(faqStore.query)

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

  it('sub-divide seções com conteúdo maior que o teto de tamanho', () => {
    const paragraph = 'Frase de exemplo com conteúdo relevante para o teste. '.repeat(10).trim()
    // 5 parágrafos de ~500 chars cada → conteúdo total bem acima do teto (1000)
    const bigContent = Array.from({ length: 5 }, () => paragraph).join('\n\n')
    const md = `## Seção grande\n\n${bigContent}`

    const chunks = parseMarkdownToChunks(md)

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk) => {
      expect(chunk.heading).toBe('Seção grande')
      expect(chunk.text.startsWith('Seção grande\n\n')).toBe(true)
    })
    // o conteúdo original inteiro deve estar preservado, apenas repartido
    const rejoined = chunks.map((c) => c.text.replace('Seção grande\n\n', '')).join('\n\n')
    expect(rejoined).toBe(bigContent)
  })

  it('não sub-divide seções dentro do teto de tamanho', () => {
    const md = '## Seção pequena\n\nConteúdo curto que não precisa ser dividido.'
    const chunks = parseMarkdownToChunks(md)
    expect(chunks).toHaveLength(1)
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
  beforeEach(() => {
    mockEmbed.mockReset()
    mockQuery.mockReset()
  })

  it('chama generateEmbedding com a query fornecida', async () => {
    mockEmbed.mockResolvedValue([1, 0, 0])
    mockQuery.mockResolvedValue([])

    await retrieveTopK('minha pergunta', 3)

    expect(mockEmbed).toHaveBeenCalledWith('minha pergunta')
  })

  it('delega a busca ao faqStore.query com o embedding e k corretos', async () => {
    const embedding = [0.1, 0.2, 0.3]
    mockEmbed.mockResolvedValue(embedding)
    mockQuery.mockResolvedValue([])

    await retrieveTopK('pergunta', 5)

    expect(mockQuery).toHaveBeenCalledWith(embedding, 5)
  })

  it('retorna os chunks devolvidos pelo faqStore.query', async () => {
    mockEmbed.mockResolvedValue([1, 0])
    const expected = [
      { heading: 'Alvo', text: 'Alvo\n\nConteúdo.', score: 0.9 },
      { heading: 'Outro', text: 'Outro\n\nConteúdo.', score: 0.8 },
    ]
    mockQuery.mockResolvedValue(expected)

    const result = await retrieveTopK('query', 2)

    expect(result).toEqual(expected)
  })

  it('gera o embedding da query exatamente uma vez por chamada', async () => {
    mockEmbed.mockResolvedValue([1, 0])
    mockQuery.mockResolvedValue([])

    await retrieveTopK('pergunta', 3)

    expect(mockEmbed).toHaveBeenCalledTimes(1)
  })
})
