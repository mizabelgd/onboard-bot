import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { MessageFeedback, MetricsFile, ResponseTiming, SessionSummary } from '../types'

const METRICS_FILE = join(process.cwd(), 'uploads', 'metrics.json')

// Persiste no globalThis para sobreviver ao HMR do Next.js em desenvolvimento
const g = globalThis as typeof globalThis & { __metricsStore: MetricsFile | null }

if (g.__metricsStore === undefined) {
  g.__metricsStore = null
}

async function load(): Promise<void> {
  if (g.__metricsStore !== null) return
  try {
    const raw = await readFile(METRICS_FILE, 'utf-8')
    g.__metricsStore = JSON.parse(raw) as MetricsFile
  } catch {
    // arquivo ainda não existe — inicializa vazio
    g.__metricsStore = { feedbacks: [], timings: [], sessions: [] }
  }
}

async function persist(): Promise<void> {
  await mkdir(dirname(METRICS_FILE), { recursive: true })
  await writeFile(METRICS_FILE, JSON.stringify(g.__metricsStore, null, 2), 'utf-8')
}

export const metricsStore = {
  async appendFeedback(feedback: MessageFeedback): Promise<void> {
    await load()
    g.__metricsStore!.feedbacks.push(feedback)
    await persist()
  },

  async appendTiming(timing: ResponseTiming): Promise<void> {
    await load()
    g.__metricsStore!.timings.push(timing)
    await persist()
  },

  async appendSession(session: SessionSummary): Promise<void> {
    await load()
    g.__metricsStore!.sessions.push(session)
    await persist()
  },

  async getAll(): Promise<MetricsFile> {
    await load()
    return g.__metricsStore!
  },
}
