/**
 * Testes de integração do pipeline RAG — Etapa 4 do roadmap.
 *
 * Todos os cenários usam mocks para generateEmbedding e generateAnswer,
 * eliminando chamadas reais à API do Gemini durante os testes.
 *
 * Cenários cobertos:
 *   1. Upload válido → indexação → chat completo
 *   2. Troca de FAQ durante sessão ativa
 *   3. Pergunta fora do FAQ (resposta negativa do modelo)
 *   4. Chunks recuperados aparecem no response do chat
 *   5. Upload inválido — extensão errada
 *   6. Upload inválido — sem headings ##
 *   7. Upload inválido — arquivo vazio
 *   8. Chat sem FAQ carregada (store vazio)
 *   9. Restart do servidor — re-indexação a partir de index.json
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { faqStore, initStoreFromDisk } from '@/lib/store'

// --- Mocks hoistados pelo Vitest (executados antes dos imports) ---

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(
    Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  ),
}))

vi.mock('@/lib/gemini', () => ({
  generateEmbedding: vi.fn(),
  generateAnswer: vi.fn(),
}))

import { readFile } from 'fs/promises'
import { generateEmbedding, generateAnswer } from '@/lib/gemini'
import { POST as uploadPOST } from '@/app/api/faq/upload/route'
import { GET as faqGET } from '@/app/api/faq/route'
import { POST as chatPOST } from '@/app/api/chat/route'

const mockEmbed = vi.mocked(generateEmbedding)
const mockAnswer = vi.mocked(generateAnswer)
const mockReadFile = vi.mocked(readFile)

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
const EMBEDDING_FIXO = new Array(768).fill(0.1)

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
  faqStore.clear()
  // resetAllMocks limpa histórico E fila de mockResolvedValueOnce — evita vazamentos entre testes
  vi.resetAllMocks()
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

    expect(faqStore.get()).toHaveLength(3)
    expect(faqStore.getStatus().loaded).toBe(true)
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
    expect(faqStore.get()).toHaveLength(3)

    await uploadPOST(makeUploadRequest(FAQ_NOVA, 'faq-nova.md'))

    expect(faqStore.get()).toHaveLength(5)
    expect(faqStore.getStatus().filename).toBe('faq-nova.md')
    expect(faqStore.getStatus().chunkCount).toBe(5)
  })

  it('após troca, chat usa os chunks da nova FAQ', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    await uploadPOST(makeUploadRequest(FAQ_NOVA, 'faq-nova.md'))

    const res = await chatPOST(makeChatRequest('Como fazer deploy?'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.retrievedChunks).toBeDefined()
    // Os headings devem ser da nova FAQ
    const headingsDisponiveis = faqStore.get().map((c) => c.heading)
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

    const headingsValidos = ['Como solicitar acesso ao Git?',
      'Como configurar o ambiente local?',
      'Como abrir um Pull Request?']

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
    const chunksAntes = faqStore.get().length

    await uploadPOST(makeUploadRequest('Sem headings'))

    expect(faqStore.get()).toHaveLength(chunksAntes)
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
// Cenário extra — GET /api/faq
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

// ===========================================================================
// Cenário 7 — Restart do servidor (re-indexação a partir de index.json)
// ===========================================================================

describe('Cenário 7: restart do servidor — re-indexação a partir de index.json', () => {
  const SAVED_STATE = {
    chunks: [
      {
        heading: 'Como fazer deploy?',
        text: 'Como fazer deploy?\n\nExecute o workflow de deploy no GitHub Actions.',
        embedding: EMBEDDING_FIXO,
      },
    ],
    filename: 'faq-salva.md',
    indexedAt: '2026-06-01T00:00:00.000Z',
  }

  it('carrega chunks do index.json quando o store está vazio', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(SAVED_STATE))

    await initStoreFromDisk()

    expect(faqStore.get()).toHaveLength(1)
    expect(faqStore.getStatus().loaded).toBe(true)
    expect(faqStore.getStatus().filename).toBe('faq-salva.md')
    expect(faqStore.getStatus().indexedAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('não sobrescreve FAQ ativa já carregada em memória', async () => {
    await uploadPOST(makeUploadRequest(FAQ_VALIDA))
    const chunksAntes = faqStore.get().length

    mockReadFile.mockResolvedValueOnce(JSON.stringify(SAVED_STATE))
    await initStoreFromDisk()

    expect(faqStore.get()).toHaveLength(chunksAntes)
    expect(faqStore.getStatus().filename).toBe('faq.md')
  })

  it('mantém store vazio se index.json não existir', async () => {
    // mockReadFile já rejeita com ENOENT pelo beforeEach
    await initStoreFromDisk()

    expect(faqStore.get()).toEqual([])
    expect(faqStore.getStatus().loaded).toBe(false)
  })

  it('ignora index.json corrompido sem lançar erro', async () => {
    mockReadFile.mockResolvedValueOnce('{ json: inválido }')

    await expect(initStoreFromDisk()).resolves.toBeUndefined()
    expect(faqStore.get()).toEqual([])
  })

  it('após restart simulado, chat responde com a FAQ do index.json sem novo upload', async () => {
    // Simula restart: store vazio mas index.json existe no disco
    mockReadFile.mockResolvedValueOnce(JSON.stringify(SAVED_STATE))

    const res = await chatPOST(makeChatRequest('Como fazer deploy?'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.answer).toBe(RESPOSTA_MODELO)
    expect(body.retrievedChunks).toContain('Como fazer deploy?')
  })
})
