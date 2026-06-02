'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { FAQStatus } from '@/types'

interface FAQViewerProps {
  refreshKey?: number
}

export default function FAQViewer({ refreshKey = 0 }: FAQViewerProps) {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<FAQStatus>({ loaded: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    async function fetchFaq() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/faq')
        const data = (await res.json()) as { content: string; status: FAQStatus }
        setContent(data.content)
        setStatus(data.status)
      } catch {
        // falha silenciosa — estado inicial sem FAQ
      } finally {
        setIsLoading(false)
      }
    }
    fetchFaq()
  }, [refreshKey])

  if (isLoading) {
    return <p className="text-sm text-neutral-400">Carregando FAQ...</p>
  }

  if (!status.loaded || !content) {
    return (
      <p className="text-sm text-neutral-400 italic">
        Nenhuma FAQ carregada. Faça o upload de um arquivo .md acima.
      </p>
    )
  }

  const uploadedAt = status.indexedAt
    ? new Date(status.indexedAt).toLocaleString('pt-BR')
    : null

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full text-left gap-2 group"
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-neutral-800 truncate">{status.filename}</span>
          <span className="text-xs text-neutral-500">
            {status.chunkCount} {status.chunkCount === 1 ? 'seção' : 'seções'}
            {uploadedAt ? ` · indexado em ${uploadedAt}` : ''}
          </span>
        </div>
        <span className="text-neutral-400 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="overflow-y-auto max-h-96 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800 leading-relaxed [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:mb-2 [&_code]:bg-neutral-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
