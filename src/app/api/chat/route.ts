import { NextRequest, NextResponse } from 'next/server'
import { faqStore, initStoreFromDisk } from '@/lib/store'
import { metricsStore } from '@/lib/metrics-store'
import { retrieveTopK } from '@/lib/rag'
import { generateAnswer } from '@/lib/gemini'
import type { ChatRequest, ChatResponse, Message, ResponseTiming } from '@/types'

const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT ?? '6', 10)
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K ?? '3', 10)

/**
 * Monta o prompt RAG completo com instrução do sistema, contexto recuperado,
 * histórico da conversa e a pergunta atual.
 *
 * O histórico é truncado nas últimas HISTORY_LIMIT mensagens para evitar
 * que o prompt cresça indefinidamente ao longo da sessão.
 */
function buildRagPrompt(
  chunks: { heading: string; text: string }[],
  history: Message[],
  message: string
): string {
  const system = `Você é um assistente de onboarding de desenvolvedores chamado OnboardBot.

Para saudações, agradecimentos ou mensagens de conversa geral (ex: "oi", "obrigado", "tchau"), responda de forma natural e amigável — sem mencionar o FAQ.

Antes de tentar responder uma pergunta técnica, avalie se ela tem especificidade suficiente. Se a pergunta for genérica demais para ter uma resposta útil sem mais contexto — por exemplo, não especifica qual ferramenta, qual erro, qual processo ou qual ambiente — peça uma informação específica que permita ajudar melhor.
Exemplos de perguntas genéricas que devem gerar pedido de esclarecimento:
- "como resolver um erro" → pergunte: qual erro está aparecendo?
- "não consigo acessar" → pergunte: acessar o quê?
- "como configuro?" → pergunte: configurar qual ferramenta ou ambiente?
Faça apenas uma pergunta de esclarecimento por vez, de forma direta e amigável.

Para perguntas suficientemente específicas sobre processos, ferramentas ou informações da empresa, responda APENAS com base nos trechos de FAQ fornecidos abaixo. Não use conhecimento externo.
Se a pergunta for específica mas a informação não estiver nos trechos fornecidos, diga: "Não encontrei essa informação no FAQ atual. Por favor, consulte seu time ou supervisor."

Seja direto e objetivo.`

  const context = chunks
    .map((chunk, i) => `[Trecho ${i + 1}]\n${chunk.text}`)
    .join('\n\n')

  const recentHistory = history.slice(-HISTORY_LIMIT)
  const historySection =
    recentHistory.length > 0
      ? '\n\n[Histórico da Conversa]\n' +
        recentHistory
          .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
          .join('\n')
      : ''

  return `${system}\n\n[Contexto Recuperado]\n${context}${historySection}\n\n[Pergunta]\n${message}`
}

/**
 * POST /api/chat
 *
 * Executa o pipeline RAG completo para uma mensagem do usuário:
 *   1. Valida a mensagem e o estado do store
 *   2. Recupera os top-3 chunks semanticamente mais relevantes (com timing)
 *   3. Monta o prompt RAG com contexto + histórico + pergunta
 *   4. Envia ao Gemini Flash e retorna a resposta (com timing)
 *   5. Persiste ResponseTiming em metrics.json se sessionId fornecido
 *
 * @param request JSON { message, history, sessionId? }
 * @returns 200 { answer, retrievedChunks, timing } | 400 { error } | 500 { error }
 */
export async function POST(request: NextRequest) {
  try {
    await initStoreFromDisk()
    const body = (await request.json()) as ChatRequest
    const { message, history = [], sessionId } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem não pode ser vazia.' }, { status: 400 })
    }

    const chunks = faqStore.get()
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma FAQ carregada. Faça o upload de um arquivo .md primeiro.' },
        { status: 400 }
      )
    }

    const retrievalStart = Date.now()
    const topChunks = await retrieveTopK(message, chunks, RAG_TOP_K)
    const retrievalTimeMs = Date.now() - retrievalStart

    const prompt = buildRagPrompt(topChunks, history, message)

    const generationStart = Date.now()
    const answer = await generateAnswer(prompt)
    const generationTimeMs = Date.now() - generationStart

    const messageId = crypto.randomUUID()
    const totalTimeMs = retrievalTimeMs + generationTimeMs

    if (sessionId) {
      const timing: ResponseTiming = {
        messageId,
        sessionId,
        retrievalTimeMs,
        generationTimeMs,
        totalTimeMs,
        timestamp: new Date().toISOString(),
      }
      // falha silenciosa — não deve derrubar a resposta do chat
      metricsStore.appendTiming(timing).catch((err) =>
        console.error('[POST /api/chat] metrics write failed', err)
      )
    }

    const response: ChatResponse = {
      answer,
      retrievedChunks: topChunks.map((c) => c.heading),
      timing: { messageId, retrievalTimeMs, generationTimeMs, totalTimeMs },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[POST /api/chat]', error)
    return NextResponse.json({ error: 'Erro interno ao processar a mensagem.' }, { status: 500 })
  }
}
