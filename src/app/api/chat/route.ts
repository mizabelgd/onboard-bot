import { NextRequest, NextResponse } from 'next/server'
import { faqStore } from '@/lib/store'
import { retrieveTopK } from '@/lib/rag'
import { generateAnswer } from '@/lib/gemini'
import type { ChatRequest, ChatResponse, Message } from '@/types'

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
Responda APENAS com base nos trechos de FAQ fornecidos abaixo. Não use conhecimento externo.
Se a pergunta não puder ser respondida com os trechos fornecidos, diga: "Não encontrei essa informação no FAQ atual. Por favor, consulte seu time ou supervisor."
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
 *   2. Recupera os top-3 chunks semanticamente mais relevantes
 *   3. Monta o prompt RAG com contexto + histórico + pergunta
 *   4. Envia ao Gemini Flash e retorna a resposta
 *
 * @param request JSON { message: string, history: Message[] }
 * @returns 200 { answer, retrievedChunks } | 400 { error } | 500 { error }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest
    const { message, history = [] } = body

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

    const topChunks = await retrieveTopK(message, chunks, RAG_TOP_K)
    const prompt = buildRagPrompt(topChunks, history, message)
    const answer = await generateAnswer(prompt)

    const response: ChatResponse = {
      answer,
      retrievedChunks: topChunks.map((c) => c.heading),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[POST /api/chat]', error)
    return NextResponse.json({ error: 'Erro interno ao processar a mensagem.' }, { status: 500 })
  }
}
