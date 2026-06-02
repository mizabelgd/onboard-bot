import { describe, it, expect, beforeEach } from 'vitest'
import { faqStore } from '@/lib/store'
import type { FAQChunk } from '@/types'

const makeChunk = (heading: string): FAQChunk => ({
  heading,
  text: `${heading}\n\nConteúdo da seção.`,
  embedding: [0.1, 0.2, 0.3],
})

beforeEach(() => {
  faqStore.clear()
})

describe('faqStore — estado inicial', () => {
  it('get() retorna array vazio antes de qualquer set()', () => {
    expect(faqStore.get()).toEqual([])
  })

  it('getStatus() retorna loaded: false antes de qualquer set()', () => {
    expect(faqStore.getStatus()).toEqual({ loaded: false })
  })
})

describe('faqStore — após set()', () => {
  it('get() retorna os chunks salvos', () => {
    const chunks = [makeChunk('Pergunta A'), makeChunk('Pergunta B')]
    faqStore.set(chunks, 'faq.md')
    expect(faqStore.get()).toEqual(chunks)
  })

  it('getStatus() retorna loaded: true com metadados corretos', () => {
    const chunks = [makeChunk('Pergunta A')]
    faqStore.set(chunks, 'minha-faq.md')

    const status = faqStore.getStatus()
    expect(status.loaded).toBe(true)
    expect(status.filename).toBe('minha-faq.md')
    expect(status.chunkCount).toBe(1)
    expect(status.indexedAt).toBeDefined()
  })

  it('indexedAt é uma data ISO válida', () => {
    faqStore.set([makeChunk('A')], 'faq.md')
    const { indexedAt } = faqStore.getStatus()
    expect(new Date(indexedAt!).toISOString()).toBe(indexedAt)
  })

  it('um novo set() substitui completamente a FAQ anterior', () => {
    faqStore.set([makeChunk('Antiga')], 'antiga.md')
    faqStore.set([makeChunk('Nova A'), makeChunk('Nova B')], 'nova.md')

    const status = faqStore.getStatus()
    expect(faqStore.get()).toHaveLength(2)
    expect(status.filename).toBe('nova.md')
    expect(status.chunkCount).toBe(2)
  })
})

describe('faqStore — clear()', () => {
  it('clear() retorna ao estado inicial', () => {
    faqStore.set([makeChunk('A')], 'faq.md')
    faqStore.clear()

    expect(faqStore.get()).toEqual([])
    expect(faqStore.getStatus()).toEqual({ loaded: false })
  })
})
