const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'phi3'

// Parâmetros de geração — chatbot de FAQ precisa ser factual e ter latência
// de cauda limitada, não criatividade nem respostas ilimitadas:
//   temperature: baixa (0.2) — respostas devem ficar grudadas no contexto
//     recuperado (default do Ollama é 0.8, alto demais para Q&A factual).
//   num_predict: teto de 512 tokens — evita geração sem fim (chegou a
//     ultrapassar 500 tokens sem sinal de parada em teste), mas alto o
//     suficiente para não cortar respostas técnicas de múltiplos passos
//     no meio da frase (300 se mostrou baixo demais em uso real).
//   num_ctx: 4096 — 2048 já causou corrupção de contexto em conversas
//     longas: com histórico de várias trocas, o prompt (sistema + contexto
//     + histórico) passa de 2048 tokens e o Ollama descarta os tokens mais
//     antigos (justo as instruções de sistema, que ficam no início),
//     fazendo o modelo perder o grounding e alucinar. Reduzir num_ctx não
//     trouxe ganho de velocidade medido (ver docs/perf-report.md) — não
//     vale o risco de corromper o prompt em sessões com várias perguntas.
//   stop: o phi3 (Q4_0) não emite EOS de forma confiável depois de responder
//     — em testes reais, depois de terminar a resposta correta ele "continua"
//     e passa a gerar texto de um padrão de dataset de instruction-tuning
//     (algo como "### Instrução mais difícil, com N restrições adicionais...",
//     às vezes em outro idioma). Em todos os casos observados, esse desvio
//     vem sempre depois de "\n---" ou de um heading "\n###" — usar essas
//     sequências como stop corta a geração exatamente onde a resposta real
//     termina, antes do texto alucinado aparecer.
const GENERATION_OPTIONS = {
  temperature: 0.2,
  num_predict: 512,
  num_ctx: 4096,
  stop: ['\n---', '\n###'],
}

// Mantém o modelo carregado em memória por mais tempo que o default (5min)
// para evitar picos de load_duration em sessões de teste/demo com gaps.
const KEEP_ALIVE = '30m'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatStreamChunk {
  message?: { role: string; content: string }
  done: boolean
  load_duration?: number        // ns
  prompt_eval_count?: number
  prompt_eval_duration?: number // ns
  eval_count?: number
  eval_duration?: number        // ns
}

export interface OllamaGenerationStats {
  fullText: string
  loadDurationMs: number
  promptEvalDurationMs: number
  evalDurationMs: number
  evalCount: number
}

const nsToMs = (ns: number | undefined) => (ns ?? 0) / 1e6

/**
 * Envia mensagens (system + histórico + pergunta) ao Ollama via /api/chat,
 * com streaming habilitado. Usar turnos reais (em vez de achatar tudo num
 * único prompt de texto) é o que permite ao Ollama aplicar o template de
 * chat do modelo e os tokens de parada nativos entre cada turno — essencial
 * para o modelo não "continuar" a conversa sozinho depois de responder.
 *
 * Chama `onToken` a cada pedaço de texto recebido e retorna o texto
 * completo + as durações internas reportadas pelo Ollama (prefill vs.
 * geração pura) ao final.
 *
 * @param messages Mensagens no formato de chat (system + histórico + pergunta atual).
 * @param onToken Callback invocado a cada pedaço de texto gerado.
 */
export async function generateAnswerStream(
  messages: OllamaMessage[],
  onToken: (text: string) => void
): Promise<OllamaGenerationStats> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
      keep_alive: KEEP_ALIVE,
      options: GENERATION_OPTIONS,
    }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`Ollama retornou status ${res.status}. Verifique se o serviço está rodando e o modelo "${OLLAMA_MODEL}" foi baixado.`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let final: OllamaChatStreamChunk | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line) as OllamaChatStreamChunk
      if (chunk.message?.content) {
        fullText += chunk.message.content
        onToken(chunk.message.content)
      }
      if (chunk.done) final = chunk
    }
  }

  return {
    fullText,
    loadDurationMs: nsToMs(final?.load_duration),
    promptEvalDurationMs: nsToMs(final?.prompt_eval_duration),
    evalDurationMs: nsToMs(final?.eval_duration),
    evalCount: final?.eval_count ?? 0,
  }
}
