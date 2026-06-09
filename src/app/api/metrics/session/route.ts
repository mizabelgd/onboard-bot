import { NextRequest, NextResponse } from 'next/server'
import { metricsStore } from '@/lib/metrics-store'
import type { SessionSummary } from '@/types'

/**
 * POST /api/metrics/session
 *
 * Registra o resumo de uma sessão ao encerrar a conversa.
 * startedAt e endedAt vêm do cliente — refletem a duração real da sessão.
 *
 * @param request JSON SessionSummary
 * @returns 200 { success: true } | 400 { error } | 500 { error }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SessionSummary>
    const { sessionId, startedAt, endedAt, userMessageCount, resolved, satisfactionScore } = body

    if (!sessionId || !startedAt || !endedAt || userMessageCount == null) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: sessionId, startedAt, endedAt, userMessageCount.' },
        { status: 400 }
      )
    }
    if (satisfactionScore !== undefined && ![1, 2, 3, 4, 5].includes(satisfactionScore)) {
      return NextResponse.json(
        { error: 'satisfactionScore deve ser um número entre 1 e 5.' },
        { status: 400 }
      )
    }

    const session: SessionSummary = { sessionId, startedAt, endedAt, userMessageCount }
    if (resolved !== undefined) session.resolved = resolved
    if (satisfactionScore !== undefined) session.satisfactionScore = satisfactionScore

    await metricsStore.appendSession(session)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/metrics/session]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
