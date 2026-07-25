/**
 * Testes de integração do pipeline RAG.
 *
 * Todos os cenários usam mocks para generateEmbedding (embeddings locais),
 * generateAnswer (Ollama) e faqStore (ChromaDB), eliminando dependências
 * externas nos testes.
 *
 * Cenários cobertos:
 *   1. Upload válido → indexação → chat completo
 *   2. Troca de FAQ durante sessão ativa
 *   3. Pergunta fora do FAQ (resposta negativa do modelo)
 *   4. Chunks recuperados aparecem no response do chat
 *   5. Upload inválido — extensão errada / sem headings / arquivo vazio
 *   6. Chat sem FAQ carregada / mensagem vazia
 *   7. GET /api/faq — status antes e após upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FAQChunk } from '@/types'

// --- Mocks hoistados pelo Vitest (executados antes dos imports) ---

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(
    Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  ),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/embeddings', () => ({
  generateEmbedding: vi.fn(),
}))

vi.mock('@/lib/llm', () => ({
  generateAnswer: vi.fn(),
}))

// Mock do store: substitui o ChromaDB por uma implementação in-memory controlada pelos testes
vi.mock('@/lib/store', () => ({
  faqStore: {
    set: vi.fn(),
    getStatus: vi.fn(),
    clear: vi.fn(),
    query: vi.fn(),
  },
}))

import { readFile } from 'fs/promises'
import { generateEmbedding } from '@/lib/embeddings'
import { generateAnswer } from '@/lib/llm'
import { faqStore } from '@/lib/store'
import { POST as uploadPOST } from '@/app/api/faq/upload/route'
import { GET as faqGET } from '@/app/api/faq/route'
import { POST as chatPOST } from '@/app/api/chat/route'

const mockEmbed = vi.mocked(generateEmbedding)
const mockAnswer = vi.mocked(generateAnswer)
const mockReadFile = vi.mocked(readFile)
const mockSet = vi.mocked(faqStore.set)
const mockGetStatus = vi.mocked(faqStore.getStatus)
const mockClear = vi.mocked(faqStore.clear)
const mockQuery = vi.mocked(faqStore.query)

// --- Fixtures ---

const FAQ_VALIDA = `## Como solicitar acesso ao Git?

Abra um chamado no Jira com o template "Acesso Git".

## Como configurar o ambiente local?

Execute npm install e configure o arquivo .env.local com as variáveis do projeto.

## Como abrir um Pull Request?

Crie uma branch a partir de main e abra um PR no GitHub com pelo menos 1 revisor.`

const FAQ_NOVA = `## Como fazer deploy?

Execute o workflow de deploy no GitHub Actions e aguarde aprovação.

## Como acessar o Jira?

Acesse jira.nexus.com.br com seu e-mail corporativo.

## Como usar o Slack?

Baixe o Slack e faça login em nexus-sistemas.slack.com.

## Como solicitar acesso ao banco?

Abra um chamado com o template Acesso — Banco de Dados.

## Como conectar à VPN?

Instale o Cisco AnyConnect e use vpn.nexus.com.br.`

const RESPOSTA_MODELO = 'Para configurar o ambiente local, execute npm install...'
const RESPOSTA_FORA_FAQ =
  'Não encontrei essa informação no FAQ atual. Por favor, consulte seu time ou supervisor.'
const EMBEDDING_FIXO = new Array(384).fill(0.1)

// Estado in-memory que o mock do store controla
let _storeChunks: Array<{ heading: string; text: string }> = []
let _storeFilename = ''

// --- Helpers ---

function makeUploadRequest(content: string, filename = 'faq.md'): NextRequest {
  const formData = new FormData()
  formData.append('file', new File([content], filename, { type: 'text/markdown' }))
  return new NextRequest('http://localhost/api/faq/upload', {
    method: 'POST',
    body: formData,
  })
}

function makeChatRequest(message: string, history = []): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
}

// --- Setup ---

beforeEach(() => {
  _storeChunks = []
  _storeFilename = ''
  vi.resetAllMocks()

  // Implementação in-memory do store para cada teste
  mockSet.mockImplementation(async (chunks: FAQChunk[], filename: string) => {
    _storeChunks = chunks.map((c) => ({ heading: c.heading, text: c.text }))
    _storeFilename = filename
  })
  mockGetStatus.mockImplementation(async () => {
    if (_storeChunks.length === 0) return { loaded: false }
    return {
      loaded: true,
      filename: _storeFilename,
      indexedAt: '2026-01-01T00:00:00.000Z',
      chunkCount: _storeChunks.length,
    }
  })
  mockClear.mockImplementation(async () => {
    _storeChunks = []
    _storeFilename = ''
  })
  mockQuery.mockImplementation(async (_embedding: number[], k: number) =>
    _storeChunks.slice(0, k)
  )

  mockEmbed.mockResolvedValue(EMBEDDING_FIXO)
  mockAnswer.mockResolvedValue(RESPOSTA_MODELO)
  mockReadFile.mockRejectedValue(
    Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  )
})

// ===========================================================================
// Cenário 1 — Upload válido → indexação → chat completo
// ===========================================================================

describe('Cenário 1: upload → indexação → chat completo', () => {
  it('upload retorna success: true com chunkCount e filename corretos', async () => {
    const res = await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.filename).toBe('faq.md')
    expect(body.chunkCount).toBe(3)
  })

  it('upload indexa os chunks corretamente no store', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    expect(_storeChunks).toHaveLength(3)
    expect(await faqStore.getStatus()).toMatchObject({ loaded: true })
  })

  it('generateEmbedding é chamado uma vez por chunk durante a indexação', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    // 3 chunks → 3 chamadas de embedding
    expect(mockEmbed).toHaveBeenCalledTimes(3)
  })

  it('chat retorna answer e retrievedChunks após upload', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    const res = await chatPOST(makeChatRequest('Como configuro o ambiente?'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.answer).toBe(RESPOSTA_MODELO)
    expect(Array.isArray(body.retrievedChunks)).toBe(true)
    expect(body.retrievedChunks.length).toBeGreaterThan(0)
  })
})

// ===========================================================================
// Cenário 2 — Troca de FAQ durante sessão ativa
// ===========================================================================

describe('Cenário 2: troca de FAQ durante sessão ativa', () => {
  it('novo upload substitui a FAQ anterior no store', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    expect(_storeChunks).toHaveLength(3)

    await uploadPOST(makeUploadRequest(FAQ_NOVA, 'faq-nova.md'))

    expect(_storeChunks).toHaveLength(5)
    const status = await faqStore.getStatus()
    expect(status.filename).toBe('faq-nova.md')
    expect(status.chunkCount).toBe(5)
  })

  it('após troca, chat usa os chunks da nova FAQ', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    await uploadPOST(makeUploadRequest(FAQ_NOVA, 'faq-nova.md'))

    const res = await chatPOST(makeChatRequest('Como fazer deploy?'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.retrievedChunks).toBeDefined()
    // Os headings devem pertencer à nova FAQ
    const headingsDisponiveis = _storeChunks.map((c) => c.heading)
    body.retrievedChunks.forEach((heading: string) => {
      expect(headingsDisponiveis).toContain(heading)
    })
  })
})

// ===========================================================================
// Cenário 3 — Pergunta fora do FAQ
// ===========================================================================

describe('Cenário 3: pergunta fora do FAQ', () => {
  it('resposta do modelo é repassada ao cliente sem modificação', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    mockAnswer.mockResolvedValue(RESPOSTA_FORA_FAQ)

    const res = await chatPOST(makeChatRequest('Como fazer uma pizza?'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.answer).toBe(RESPOSTA_FORA_FAQ)
  })
})

// ===========================================================================
// Cenário 4 — Chunks recuperados visíveis no response
// ===========================================================================

describe('Cenário 4: chunks recuperados por pergunta', () => {
  it('retrievedChunks contém headings válidos do FAQ carregado', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    const res = await chatPOST(makeChatRequest('Como abrir um PR?'))
    const { retrievedChunks } = await res.json()

    const headingsValidos = [
      'Como solicitar acesso ao Git?',
      'Como configurar o ambiente local?',
      'Como abrir um Pull Request?',
    ]
    retrievedChunks.forEach((heading: string) => {
      expect(headingsValidos).toContain(heading)
    })
  })

  it('número de retrievedChunks respeita o limite RAG_TOP_K (máx 3 por padrão)', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    const res = await chatPOST(makeChatRequest('Alguma pergunta'))
    const { retrievedChunks } = await res.json()

    expect(retrievedChunks.length).toBeLessThanOrEqual(3)
  })
})

// ===========================================================================
// Cenário 5 — Upload inválido
// ===========================================================================

describe('Cenário 5: upload inválido', () => {
  it('retorna 400 quando nenhum arquivo é enviado', async () => {
    const req = new NextRequest('http://localhost/api/faq/upload', {
      method: 'POST',
      body: new FormData(),
    })
    const res = await uploadPOST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('retorna 400 para extensão diferente de .md', async () => {
    const formData = new FormData()
    formData.append('file', new File(['conteúdo'], 'faq.txt', { type: 'text/plain' }))
    const req = new NextRequest('http://localhost/api/faq/upload', {
      method: 'POST',
      body: formData,
    })

    const res = await uploadPOST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/\.md/)
  })

  it('retorna 400 para arquivo .md sem headings ##', async () => {
    const res = await uploadPOST(
      makeUploadRequest('Texto sem nenhum heading de segundo nível.')
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('retorna 400 para arquivo .md vazio', async () => {
    const res = await uploadPOST(makeUploadRequest('   '))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('não modifica o store quando o upload falha por validação', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    const chunksAntes = _storeChunks.length

    await uploadPOST(makeUploadRequest('Sem headings'))

    expect(_storeChunks).toHaveLength(chunksAntes)
  })
})

// ===========================================================================
// Cenário 6 — Chat sem FAQ carregada
// ===========================================================================

describe('Cenário 6: chat sem FAQ carregada', () => {
  it('retorna 400 com mensagem de erro quando o store está vazio', async () => {
    const res = await chatPOST(makeChatRequest('Como configuro o ambiente?'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/FAQ/i)
  })

  it('retorna 400 para mensagem vazia mesmo com FAQ carregada', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    const res = await chatPOST(makeChatRequest('   '))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('generateEmbedding não é chamado quando a mensagem é inválida', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    mockEmbed.mockClear()

    await chatPOST(makeChatRequest(''))

    expect(mockEmbed).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Cenário 7 — GET /api/faq
// ===========================================================================

describe('GET /api/faq', () => {
  it('retorna status.loaded: false quando nenhuma FAQ foi indexada', async () => {
    const res = await faqGET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status.loaded).toBe(false)
  })

  it('retorna status.loaded: true após upload bem-sucedido', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))

    const res = await faqGET()
    const body = await res.json()

    expect(body.status.loaded).toBe(true)
    expect(body.status.chunkCount).toBe(3)
    expect(body.status.filename).toBe('faq.md')
  })
})
