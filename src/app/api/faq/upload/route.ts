import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { parseMarkdownToChunks } from '@/lib/rag'
import { generateEmbedding } from '@/lib/embeddings'
import { faqStore } from '@/lib/store'
import type { FAQChunk, UploadResponse } from '@/types'

const UPLOADS_DIR = join(process.cwd(), 'uploads')

/**
 * POST /api/faq/upload
 *
 * Recebe um arquivo Markdown via multipart/form-data, executa o pipeline de
 * indexação RAG e substitui a base de conhecimento ativa.
 *
 * Pipeline:
 *   1. Valida o arquivo (.md, não vazio, contém headings ##)
 *   2. Divide o conteúdo em chunks por heading ##
 *   3. Gera embeddings de todos os chunks em paralelo (all-MiniLM-L6-v2 via ONNX)
 *   4. Persiste os chunks indexados no ChromaDB
 *   5. Persiste o arquivo original em uploads/current-faq.md
 *
 * @param request FormData com campo `file: File` (.md)
 * @returns 200 { success, chunkCount, filename } | 400 { error } | 500 { error }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    if (!file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Apenas arquivos .md são aceitos.' },
        { status: 400 }
      )
    }

    const content = await file.text()

    if (!content.trim()) {
      return NextResponse.json({ error: 'O arquivo está vazio.' }, { status: 400 })
    }

    const rawChunks = parseMarkdownToChunks(content)

    if (rawChunks.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma seção encontrada. O arquivo deve conter headings ## para separar as perguntas.' },
        { status: 400 }
      )
    }

    // Gera todos os embeddings em paralelo
    const chunks: FAQChunk[] = await Promise.all(
      rawChunks.map(async (chunk) => ({
        ...chunk,
        embedding: await generateEmbedding(chunk.text),
      }))
    )

    await faqStore.set(chunks, file.name)

    await mkdir(UPLOADS_DIR, { recursive: true })
    await writeFile(join(UPLOADS_DIR, 'current-faq.md'), content, 'utf-8')

    const response: UploadResponse = {
      success: true,
      chunkCount: chunks.length,
      filename: file.name,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[POST /api/faq/upload]', error)
    return NextResponse.json({ error: 'Erro interno ao processar o arquivo.' }, { status: 500 })
  }
}
