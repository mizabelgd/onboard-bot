import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

const MODEL = 'Xenova/all-MiniLM-L6-v2'

// Singleton que sobrevive ao HMR do Next.js em desenvolvimento.
// Guarda tanto o pipeline resolvido quanto a Promise em andamento para evitar
// race condition: Promise.all no upload dispara N generateEmbedding concorrentes
// e todas devem aguardar a mesma Promise, não iniciar N cargas do modelo ONNX.
const g = globalThis as typeof globalThis & {
  __embedder: FeatureExtractionPipeline | null
  __embedderPromise: Promise<FeatureExtractionPipeline> | null
}
if (g.__embedder === undefined) g.__embedder = null
if (g.__embedderPromise === undefined) g.__embedderPromise = null

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (g.__embedder) return g.__embedder
  if (!g.__embedderPromise) {
    g.__embedderPromise = pipeline('feature-extraction', MODEL, { dtype: 'fp32' })
      .then((p) => { g.__embedder = p; return p })
  }
  return g.__embedderPromise
}

/**
 * Gera o embedding de um texto usando all-MiniLM-L6-v2 via ONNX (local).
 * Retorna um vetor de 384 dimensões com pooling de média e normalização L2.
 *
 * @param text Texto a ser vetorizado.
 * @returns Vetor de 384 floats normalizado.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embed = await getEmbedder()
  const output = await embed(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
