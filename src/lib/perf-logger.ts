const LABEL_WIDTH = 24

function formatLine(label: string, ms: number): string {
  return `${(label + ' ').padEnd(LABEL_WIDTH, '.')} ${ms.toFixed(0)} ms`
}

/**
 * Loga, em formato tabular, o tempo gasto em cada etapa do pipeline RAG
 * de uma requisição de chat, seguido do tempo total (wall-clock real).
 *
 * Exemplo de saída:
 *   Embedding............... 45 ms
 *   Vector Search............ 12 ms
 *   LLM Inference........... 8532 ms
 *   Total.................... 8591 ms
 */
export function logPipelineTimings(stages: Record<string, number>, totalMs: number): void {
  const lines = Object.entries(stages).map(([label, ms]) => formatLine(label, ms))
  lines.push(formatLine('Total', totalMs))
  console.log(`[pipeline-timing]\n${lines.join('\n')}`)
}
