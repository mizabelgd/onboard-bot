import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { faqStore, initStoreFromDisk } from '@/lib/store'

const FAQ_FILE = join(process.cwd(), 'uploads', 'current-faq.md')
const INDEX_FILE = join(process.cwd(), 'uploads', 'index.json')

/**
 * GET /api/faq
 *
 * Retorna o conteúdo markdown da FAQ ativa e os metadados do store.
 * O conteúdo é lido do disco (uploads/current-faq.md), que persiste entre
 * restarts do servidor. O status reflete o estado do índice em memória —
 * se `status.loaded` for false, o chatbot não está pronto para responder
 * mesmo que o arquivo exista (é necessário re-fazer o upload para re-indexar).
 *
 * @returns 200 { content: string, status: FAQStatus }
 */
export async function GET() {
  await initStoreFromDisk()
  const status = faqStore.getStatus()

  let content = ''
  try {
    content = await readFile(FAQ_FILE, 'utf-8')
  } catch {
    // Arquivo ainda não existe — estado inicial da aplicação
  }

  return NextResponse.json({ content, status })
}

/**
 * DELETE /api/faq
 *
 * Remove a FAQ ativa: limpa o store em memória e apaga os arquivos de disco.
 * Erros de arquivo (ex: já inexistente) são ignorados via allSettled.
 *
 * @returns 200 { success: true }
 */
export async function DELETE() {
  faqStore.clear()

  await Promise.allSettled([unlink(FAQ_FILE), unlink(INDEX_FILE)])

  return NextResponse.json({ success: true })
}
