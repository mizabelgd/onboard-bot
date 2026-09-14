'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { FAQStatus } from '@/types'

interface FAQViewerProps {
  refreshKey?: number
  onRemove?: () => void
}

export default function FAQViewer({ refreshKey = 0, onRemove }: FAQViewerProps) {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<FAQStatus>({ loaded: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    async function fetchFaq() {
      setIsLoading(true)
      setConfirmRemove(false)
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

  async function handleRemove() {
    setIsRemoving(true)
    try {
      await fetch('/api/faq', { method: 'DELETE' })
      setContent('')
      setStatus({ loaded: false })
      setConfirmRemove(false)
      onRemove?.()
    } catch {
      setConfirmRemove(false)
    } finally {
      setIsRemoving(false)
    }
  }

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
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex flex-col min-w-0 text-left group flex-1"
        >
          <span className="text-sm font-medium text-neutral-800 truncate">{status.filename}</span>
          <span className="text-xs text-neutral-500">
            {status.chunkCount} {status.chunkCount === 1 ? 'seção' : 'seções'}
            {uploadedAt ? ` · indexado em ${uploadedAt}` : ''}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {confirmRemove ? (
            <>
              <span className="text-xs text-neutral-500 mr-1">Remover?</span>
              <button
                onClick={() => setConfirmRemove(false)}
                disabled={isRemoving}
                className="text-xs px-2 py-1 rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-40"
              >
                Não
              </button>
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="text-xs px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                {isRemoving ? 'Removendo...' : 'Sim'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="text-neutral-400 text-xs px-1"
                aria-label={isOpen ? 'Recolher FAQ' : 'Expandir FAQ'}
              >
                {isOpen ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setConfirmRemove(true)}
                className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                aria-label="Remover FAQ"
                title="Remover FAQ"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="overflow-y-auto max-h-96 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800 leading-relaxed [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:mb-2 [&_code]:bg-neutral-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
