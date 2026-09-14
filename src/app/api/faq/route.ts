import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { faqStore } from '@/lib/store'

const FAQ_FILE = join(process.cwd(), 'uploads', 'current-faq.md')

/**
 * GET /api/faq
 *
 * Retorna o conteúdo markdown da FAQ ativa e os metadados do store.
 * O conteúdo é lido do disco (uploads/current-faq.md). O status reflete
 * o estado do ChromaDB — se `status.loaded` for false o chatbot não está
 * pronto para responder (FAQ ainda não foi indexada).
 *
 * @returns 200 { content: string, status: FAQStatus }
 */
export async function GET() {
  const status = await faqStore.getStatus()

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
 * Remove a FAQ ativa: limpa o ChromaDB e apaga uploads/current-faq.md.
 * Erros de arquivo (ex: já inexistente) são ignorados via allSettled.
 *
 * @returns 200 { success: true }
 */
export async function DELETE() {
  await faqStore.clear()

  await Promise.allSettled([unlink(FAQ_FILE)])

  return NextResponse.json({ success: true })
}
