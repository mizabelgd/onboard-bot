import { NextResponse } from 'next/server'
import { metricsStore } from '@/lib/metrics-store'

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * GET /api/metrics
 *
 * Lê uploads/metrics.json e retorna as métricas calculadas nas três dimensões
 * definidas na seção 20.4 da ARQUITETURA.md:
 *   - Eficiência: tempos de resposta e mensagens por sessão
 *   - Efetividade: taxa de resolução e feedback positivo/negativo
 *   - Satisfação: nota média e taxa de preenchimento do survey
 *
 * Valores null indicam ausência de dados (sem sessões/feedbacks ainda).
 *
 * @returns 200 { totals, efficiency, effectiveness, satisfaction, recentSessions }
 */
export async function GET() {
  try {
    const { feedbacks, timings, sessions } = await metricsStore.getAll()

    // ── Eficiência ────────────────────────────────────────────────────────────
    const avgResponseTimeMs = mean(timings.map((t) => t.totalTimeMs))
    const avgRetrievalTimeMs = mean(timings.map((t) => t.retrievalTimeMs))
    const avgGenerationTimeMs = mean(timings.map((t) => t.generationTimeMs))
    const avgMessagesPerSession = mean(sessions.map((s) => s.userMessageCount))

    // ── Efetividade ───────────────────────────────────────────────────────────
    const sessionsWithResolution = sessions.filter((s) => s.resolved !== undefined)
    const resolvedSessions = sessionsWithResolution.filter((s) => s.resolved === true)
    const resolutionRate =
      sessionsWithResolution.length > 0
        ? (resolvedSessions.length / sessionsWithResolution.length) * 100
        : null

    const positiveFeedbacks = feedbacks.filter((f) => f.value === 'positive')
    const positiveFeedbackRate =
      feedbacks.length > 0 ? (positiveFeedbacks.length / feedbacks.length) * 100 : null
    const negativeFeedbackRate = positiveFeedbackRate !== null ? 100 - positiveFeedbackRate : null

    // sessões com pelo menos 1 feedback registrado
    const sessionIdsWithFeedback = new Set(feedbacks.map((f) => f.sessionId))
    const feedbackCoverage =
      sessions.length > 0 ? (sessionIdsWithFeedback.size / sessions.length) * 100 : null

    // ── Satisfação ────────────────────────────────────────────────────────────
    const sessionsWithScore = sessions.filter((s) => s.satisfactionScore !== undefined)
    const avgSatisfactionScore = mean(sessionsWithScore.map((s) => s.satisfactionScore!))
    const surveyCompletionRate =
      sessions.length > 0 ? (sessionsWithScore.length / sessions.length) * 100 : null

    const feedbacksBySession = feedbacks.reduce<Record<string, { pos: number; neg: number }>>(
      (acc, f) => {
        if (!acc[f.sessionId]) acc[f.sessionId] = { pos: 0, neg: 0 }
        if (f.value === 'positive') acc[f.sessionId].pos++
        else acc[f.sessionId].neg++
        return acc
      },
      {}
    )

    return NextResponse.json({
      totals: {
        sessions: sessions.length,
        timings: timings.length,
        feedbacks: feedbacks.length,
        positiveFeedbacks: positiveFeedbacks.length,
        negativeFeedbacks: feedbacks.length - positiveFeedbacks.length,
      },
      efficiency: {
        avgResponseTimeMs,
        avgRetrievalTimeMs,
        avgGenerationTimeMs,
        avgMessagesPerSession,
      },
      effectiveness: {
        resolutionRate,
        positiveFeedbackRate,
        negativeFeedbackRate,
        feedbackCoverage,
      },
      satisfaction: {
        avgSatisfactionScore,
        surveyCompletionRate,
      },
      recentSessions: sessions.slice(-10).reverse().map((s) => ({
        ...s,
        positiveFeedbacks: feedbacksBySession[s.sessionId]?.pos ?? 0,
        negativeFeedbacks: feedbacksBySession[s.sessionId]?.neg ?? 0,
      })),
    })
  } catch (error) {
    console.error('[GET /api/metrics]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
