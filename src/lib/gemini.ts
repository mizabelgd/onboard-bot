import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY não definida no .env.local')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' })
const llmModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

/**
 * Gera um vetor de embedding para o texto fornecido usando o modelo gemini-embedding-2.
 * @returns Array de 3072 floats representando o texto no espaço semântico.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text)
  return result.embedding.values
}

/**
 * Envia um prompt ao Gemini Flash e retorna a resposta gerada como texto.
 * O prompt já deve incluir o contexto RAG montado pelo caller.
 */
export async function generateAnswer(prompt: string): Promise<string> {
  const result = await llmModel.generateContent(prompt)
  return result.response.text()
}
