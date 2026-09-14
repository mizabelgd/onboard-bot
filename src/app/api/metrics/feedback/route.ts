import { NextRequest, NextResponse } from 'next/server'
import { metricsStore } from '@/lib/metrics-store'
import type { MessageFeedback } from '@/types'

/**
 * POST /api/metrics/feedback
 *
 * Registra o feedback 👍/👎 de uma resposta do assistente.
 * O timestamp é gerado no servidor para evitar divergências de relógio do cliente.
 *
 * @param request JSON { messageId, sessionId, value: 'positive' | 'negative' }
 * @returns 200 { success: true } | 400 { error } | 500 { error }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<MessageFeedback>
    const { messageId, sessionId, value } = body

    if (!messageId || !sessionId || !value) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: messageId, sessionId, value.' },
        { status: 400 }
      )
    }
    if (value !== 'positive' && value !== 'negative') {
      return NextResponse.json(
        { error: 'value deve ser "positive" ou "negative".' },
        { status: 400 }
      )
    }

    await metricsStore.appendFeedback({
      messageId,
      sessionId,
      value,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/metrics/feedback]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
