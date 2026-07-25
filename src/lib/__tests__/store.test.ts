import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FAQChunk } from '@/types'

const mockCount = vi.fn()
const mockGet = vi.fn()
const mockAdd = vi.fn()
const mockDelete = vi.fn()
const mockQuery = vi.fn()

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    getOrCreateCollection: vi.fn().mockResolvedValue({
      count: mockCount,
      get: mockGet,
      add: mockAdd,
      delete: mockDelete,
      query: mockQuery,
    }),
  })),
}))

import { faqStore } from '@/lib/store'

const makeChunk = (heading: string): FAQChunk => ({
  heading,
  text: `${heading}\n\nConteúdo da seção.`,
  embedding: [0.1, 0.2, 0.3],
})

beforeEach(() => {
  vi.clearAllMocks()
  const g = globalThis as Record<string, unknown>
  g.__chromaClient = undefined
  g.__chromaCollection = undefined
})

describe('faqStore.getStatus() — coleção vazia', () => {
  it('retorna { loaded: false } quando count === 0', async () => {
    mockCount.mockResolvedValue(0)
    expect(await faqStore.getStatus()).toEqual({ loaded: false })
  })

  it('retorna { loaded: false } quando ChromaDB lança erro', async () => {
    mockCount.mockRejectedValue(new Error('connection refused'))
    expect(await faqStore.getStatus()).toEqual({ loaded: false })
  })
})

describe('faqStore.getStatus() — após set()', () => {
  it('retorna metadados corretos quando há chunks indexados', async () => {
    mockCount.mockResolvedValue(2)
    mockGet.mockResolvedValue({
      ids: ['chunk_0'],
      metadatas: [{ heading: 'Pergunta A', filename: 'faq.md', indexedAt: '2026-07-24T00:00:00.000Z' }],
      documents: ['texto'],
    })

    const status = await faqStore.getStatus()
    expect(status.loaded).toBe(true)
    expect(status.chunkCount).toBe(2)
    expect(status.filename).toBe('faq.md')
    expect(status.indexedAt).toBe('2026-07-24T00:00:00.000Z')
  })
})

describe('faqStore.set()', () => {
  it('deleta IDs existentes antes de inserir', async () => {
    mockGet.mockResolvedValueOnce({ ids: ['chunk_0', 'chunk_1'], metadatas: [], documents: [] })
    mockDelete.mockResolvedValue(undefined)
    mockAdd.mockResolvedValue(undefined)

    await faqStore.set([makeChunk('Pergunta A')], 'faq.md')

    expect(mockDelete).toHaveBeenCalledWith({ ids: ['chunk_0', 'chunk_1'] })
    expect(mockAdd).toHaveBeenCalled()
  })

  it('não chama delete se não há IDs existentes', async () => {
    mockGet.mockResolvedValueOnce({ ids: [], metadatas: [], documents: [] })
    mockAdd.mockResolvedValue(undefined)

    await faqStore.set([makeChunk('Pergunta A')], 'faq.md')

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockAdd).toHaveBeenCalled()
  })

  it('adiciona chunks com embeddings e metadados corretos', async () => {
    mockGet.mockResolvedValueOnce({ ids: [], metadatas: [], documents: [] })
    mockAdd.mockResolvedValue(undefined)

    const chunks = [makeChunk('Pergunta A'), makeChunk('Pergunta B')]
    await faqStore.set(chunks, 'minha-faq.md')

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['chunk_0', 'chunk_1'],
        embeddings: [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3]],
        documents: [chunks[0].text, chunks[1].text],
        metadatas: [
          expect.objectContaining({ heading: 'Pergunta A', filename: 'minha-faq.md' }),
          expect.objectContaining({ heading: 'Pergunta B', filename: 'minha-faq.md' }),
        ],
      })
    )
  })
})

describe('faqStore.clear()', () => {
  it('deleta todos os chunks existentes', async () => {
    mockGet.mockResolvedValue({ ids: ['chunk_0', 'chunk_1'], metadatas: [], documents: [] })
    mockDelete.mockResolvedValue(undefined)

    await faqStore.clear()

    expect(mockDelete).toHaveBeenCalledWith({ ids: ['chunk_0', 'chunk_1'] })
  })

  it('não chama delete quando a coleção está vazia', async () => {
    mockGet.mockResolvedValue({ ids: [], metadatas: [], documents: [] })

    await faqStore.clear()

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('não lança erro mesmo se ChromaDB falhar', async () => {
    mockGet.mockRejectedValue(new Error('connection refused'))
    await expect(faqStore.clear()).resolves.toBeUndefined()
  })
})

describe('faqStore.query()', () => {
  it('retorna heading e text dos resultados do ChromaDB', async () => {
    mockQuery.mockResolvedValue({
      metadatas: [[{ heading: 'Como configurar?' }, { heading: 'Como usar?' }]],
      documents: [['Texto da seção 1', 'Texto da seção 2']],
    })

    const results = await faqStore.query([0.1, 0.2, 0.3], 2)

    expect(results).toEqual([
      { heading: 'Como configurar?', text: 'Texto da seção 1' },
      { heading: 'Como usar?', text: 'Texto da seção 2' },
    ])
    expect(mockQuery).toHaveBeenCalledWith({
      queryEmbeddings: [[0.1, 0.2, 0.3]],
      nResults: 2,
    })
  })

  it('usa string vazia quando heading ou document é nulo', async () => {
    mockQuery.mockResolvedValue({
      metadatas: [[null]],
      documents: [[null]],
    })

    const results = await faqStore.query([0.1], 1)
    expect(results).toEqual([{ heading: '', text: '' }])
  })
})
