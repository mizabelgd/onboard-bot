import { env, pipeline } from '@huggingface/transformers'
import { existsSync } from 'fs'
import { join } from 'path'

// env.cacheDir é lido pelo pacote antes de cada download (lazy),
// então pode ser definido após o import sem problema.
const CACHE_HUB = join(process.cwd(), 'hf-cache-build', 'hub')
env.cacheDir = CACHE_HUB

const MODEL_DIR = join(CACHE_HUB, 'Xenova', 'all-MiniLM-L6-v2')

if (existsSync(MODEL_DIR)) {
  console.log('Modelo já presente em ./hf-cache-build — pulando download.')
  process.exit(0)
}

console.log('Baixando Xenova/all-MiniLM-L6-v2 para ./hf-cache-build ...')
await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' })
console.log('Modelo salvo em ./hf-cache-build/hub/')
process.exit(0)
