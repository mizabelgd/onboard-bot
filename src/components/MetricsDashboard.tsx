'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SessionSummary } from '@/types'

interface SessionRow extends SessionSummary {
  positiveFeedbacks: number
  negativeFeedbacks: number
}

interface MetricsData {
  totals: {
    sessions: number
    timings: number
    feedbacks: number
    positiveFeedbacks: number
    negativeFeedbacks: number
  }
  efficiency: {
    avgResponseTimeMs: number | null
    avgRetrievalTimeMs: number | null
    avgGenerationTimeMs: number | null
    avgMessagesPerSession: number | null
  }
  effectiveness: {
    resolutionRate: number | null
    positiveFeedbackRate: number | null
    negativeFeedbackRate: number | null
    feedbackCoverage: number | null
  }
  satisfaction: {
    avgSatisfactionScore: number | null
    surveyCompletionRate: number | null
  }
  rag: {
    accuracyRate: number | null
    precisionAtK: number | null
    failedRetrievalRate: number | null
    contextUtilizationRate: number | null
    hallucinationRate: number | null
    avgSimilarityScore: number | null
    totalEvaluated: number
  }
  recentSessions: SessionRow[]
}

function fmt(value: number | null, decimals = 1, suffix = ''): string {
  if (value === null) return '—'
  return value.toFixed(decimals) + suffix
}

function Stars({ score }: { score?: number }) {
  if (!score) return <span className="text-neutral-400">—</span>
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(score)}
      {'☆'.repeat(5 - score)}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  badge,
}: {
  label: string
  value: string
  sub?: string
  badge?: { ok: boolean; label: string }
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide leading-tight">
          {label}
        </span>
        {badge && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
              badge.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <span className="text-2xl font-bold text-neutral-900 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-neutral-400">{sub}</span>}
    </div>
  )
}

type CriteriaStatus = 'ok' | 'fail' | 'insufficient'

function CriteriaRow({
  label,
  target,
  value,
  status,
}: {
  label: string
  target: string
  value: string
  status: CriteriaStatus
}) {
  const icon =
    status === 'ok' ? '🟢' : status === 'fail' ? '🔴' : '🟡'
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-4 py-2.5 text-neutral-700">{label}</td>
      <td className="px-4 py-2.5 text-neutral-500 tabular-nums">{target}</td>
      <td className="px-4 py-2.5 text-neutral-700 font-medium tabular-nums">{value}</td>
      <td className="px-4 py-2.5 text-base">{icon}</td>
    </tr>
  )
}

export default function MetricsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/metrics')
      if (!res.ok) throw new Error('Erro ao carregar métricas')
      setData((await res.json()) as MetricsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-neutral-400 text-sm">
        Carregando métricas…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-red-500 text-sm">{error}</div>
    )
  }

  if (!data) return null

  const { totals, efficiency, effectiveness, satisfaction, rag, recentSessions } = data

  const MIN_EVAL = 5
  const hasRagData = rag.totalEvaluated >= MIN_EVAL

  function ragStatus(
    value: number | null,
    target: number,
    direction: 'gte' | 'lte'
  ): CriteriaStatus {
    if (!hasRagData || value === null) return 'insufficient'
    return direction === 'gte' ? (value >= target ? 'ok' : 'fail') : (value <= target ? 'ok' : 'fail')
  }

  const latencyS = efficiency.avgResponseTimeMs !== null ? efficiency.avgResponseTimeMs / 1000 : null
  const latencyStatus: CriteriaStatus =
    latencyS === null ? 'insufficient' : latencyS <= 3 ? 'ok' : 'fail'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Visão geral</h2>
        <button
          onClick={load}
          className="text-xs text-violet-600 hover:text-violet-700 font-medium"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total sessões" value={String(totals.sessions)} />
        <StatCard
          label="Msgs / sessão"
          value={fmt(efficiency.avgMessagesPerSession)}
          sub="média"
        />
        <StatCard
          label="Tempo resposta"
          value={
            efficiency.avgResponseTimeMs !== null
              ? `${(efficiency.avgResponseTimeMs / 1000).toFixed(1)}s`
              : '—'
          }
          sub="média total"
        />
        <StatCard
          label="Taxa resolução"
          value={fmt(effectiveness.resolutionRate, 0, '%')}
          sub="sessões encerradas"
        />
        <StatCard
          label="Feedback positivo"
          value={fmt(effectiveness.positiveFeedbackRate, 0, '%')}
          sub={`${totals.positiveFeedbacks} 👍  ${totals.negativeFeedbacks} 👎`}
        />
        <StatCard
          label="Satisfação"
          value={
            satisfaction.avgSatisfactionScore !== null
              ? `${satisfaction.avgSatisfactionScore.toFixed(1)} / 5`
              : '—'
          }
          sub={
            satisfaction.surveyCompletionRate !== null
              ? `${satisfaction.surveyCompletionRate.toFixed(0)}% preenchido`
              : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">Qualidade do RAG</h2>
          {!hasRagData && (
            <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
              dados insuficientes — envie {MIN_EVAL}+ perguntas com sessionId
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Acurácia"
            value={fmt(rag.accuracyRate, 0, '%')}
            sub="meta: ≥ 80%"
            badge={
              hasRagData && rag.accuracyRate !== null
                ? { ok: rag.accuracyRate >= 80, label: rag.accuracyRate >= 80 ? '✓ meta' : '✗ meta' }
                : undefined
            }
          />
          <StatCard
            label="Precision@K"
            value={fmt(rag.precisionAtK, 0, '%')}
            sub="meta: ≥ 75%"
            badge={
              hasRagData && rag.precisionAtK !== null
                ? { ok: rag.precisionAtK >= 75, label: rag.precisionAtK >= 75 ? '✓ meta' : '✗ meta' }
                : undefined
            }
          />
          <StatCard
            label="Falha de recuperação"
            value={fmt(rag.failedRetrievalRate, 0, '%')}
            sub="meta: ≤ 15%"
            badge={
              hasRagData && rag.failedRetrievalRate !== null
                ? { ok: rag.failedRetrievalRate <= 15, label: rag.failedRetrievalRate <= 15 ? '✓ meta' : '✗ meta' }
                : undefined
            }
          />
          <StatCard
            label="Uso de contexto"
            value={fmt(rag.contextUtilizationRate, 0, '%')}
            sub={`${rag.totalEvaluated} interações avaliadas`}
          />
          <StatCard
            label="Taxa de alucinação"
            value={fmt(rag.hallucinationRate, 0, '%')}
            sub="meta: ≤ 10%"
            badge={
              hasRagData && rag.hallucinationRate !== null
                ? { ok: rag.hallucinationRate <= 10, label: rag.hallucinationRate <= 10 ? '✓ meta' : '✗ meta' }
                : undefined
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Critérios de aceitação (ADR 10)</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Critério</th>
                <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Meta</th>
                <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Atual</th>
                <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <CriteriaRow
                label="Acurácia"
                target="≥ 80%"
                value={fmt(rag.accuracyRate, 0, '%')}
                status={ragStatus(rag.accuracyRate, 80, 'gte')}
              />
              <CriteriaRow
                label="Precision@K"
                target="≥ 75%"
                value={fmt(rag.precisionAtK, 0, '%')}
                status={ragStatus(rag.precisionAtK, 75, 'gte')}
              />
              <CriteriaRow
                label="Taxa de alucinação"
                target="≤ 10%"
                value={fmt(rag.hallucinationRate, 0, '%')}
                status={ragStatus(rag.hallucinationRate, 10, 'lte')}
              />
              <CriteriaRow
                label="Falha de recuperação"
                target="≤ 15%"
                value={fmt(rag.failedRetrievalRate, 0, '%')}
                status={ragStatus(rag.failedRetrievalRate, 15, 'lte')}
              />
              <CriteriaRow
                label="Latência máxima"
                target="≤ 3s"
                value={latencyS !== null ? `${latencyS.toFixed(1)}s` : '—'}
                status={latencyStatus}
              />
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-neutral-400">
          🟢 dentro do critério · 🔴 fora do critério · 🟡 dados insuficientes (&lt;{MIN_EVAL} interações)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Sessões recentes</h2>
        {recentSessions.length === 0 ? (
          <p className="text-xs text-neutral-400">Nenhuma sessão encerrada ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">ID</th>
                  <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Data</th>
                  <th className="text-right px-4 py-2.5 text-neutral-500 font-medium">Msgs</th>
                  <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Resolvida</th>
                  <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Satisfação</th>
                  <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Feedbacks</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.sessionId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2.5 font-mono text-neutral-600">{s.sessionId.slice(0, 4)}</td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {new Date(s.endedAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-600">{s.userMessageCount}</td>
                    <td className="px-4 py-2.5">
                      {s.resolved === true ? (
                        <span className="text-green-600 font-medium">Sim</span>
                      ) : s.resolved === false ? (
                        <span className="text-red-500">Não</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Stars score={s.satisfactionScore} />
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {s.positiveFeedbacks + s.negativeFeedbacks === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        `${s.positiveFeedbacks} 👍  ${s.negativeFeedbacks} 👎`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
