const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'phi3'

interface OllamaGenerateResponse {
  response: string
  done: boolean
}

/**
 * Envia um prompt ao Ollama e retorna a resposta gerada.
 * Usa a rota /api/generate com stream desabilitado — retorno único.
 *
 * Variáveis de ambiente:
 *   OLLAMA_BASE_URL — URL base do Ollama (default: http://localhost:11434)
 *   OLLAMA_MODEL    — modelo a usar (default: phi3)
 *
 * @param prompt Prompt completo (sistema + contexto + pergunta).
 * @returns Texto gerado pelo LLM.
 */
export async function generateAnswer(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })

  if (!res.ok) {
    throw new Error(`Ollama retornou status ${res.status}. Verifique se o serviço está rodando e o modelo "${OLLAMA_MODEL}" foi baixado.`)
  }

  const data = (await res.json()) as OllamaGenerateResponse
  return data.response
}
