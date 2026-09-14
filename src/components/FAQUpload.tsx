'use client'

import { useEffect, useRef, useState } from 'react'
import type { UploadResponse } from '@/types'

type Status =
  | { type: 'idle' }
  | { type: 'uploading' }
  | { type: 'success'; chunkCount: number; filename: string }
  | { type: 'error'; message: string }

interface FAQUploadProps {
  onUploadSuccess?: () => void
  resetKey?: number
}

export default function FAQUpload({ onUploadSuccess, resetKey }: FAQUploadProps) {
  const [status, setStatus] = useState<Status>({ type: 'idle' })

  useEffect(() => {
    setStatus({ type: 'idle' })
  }, [resetKey])
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!file.name.endsWith('.md')) {
      setStatus({ type: 'error', message: 'Apenas arquivos .md são aceitos.' })
      return
    }

    setStatus({ type: 'uploading' })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/faq/upload', { method: 'POST', body: formData })
      const data = (await res.json()) as UploadResponse | { error: string }

      if (!res.ok) {
        setStatus({
          type: 'error',
          message: 'error' in data ? data.error : 'Erro ao fazer upload.',
        })
        return
      }

      const result = data as UploadResponse
      setStatus({ type: 'success', chunkCount: result.chunkCount, filename: result.filename })
      onUploadSuccess?.()
    } catch {
      setStatus({ type: 'error', message: 'Falha na conexão. Tente novamente.' })
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => status.type !== 'uploading' && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && status.type !== 'uploading' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-all select-none ${
          isDragOver
            ? 'border-violet-400 bg-violet-50 scale-[1.01]'
            : status.type === 'uploading'
              ? 'border-neutral-200 bg-white cursor-default'
              : 'border-neutral-300 bg-white hover:border-violet-400 hover:bg-violet-50 cursor-pointer'
        }`}
      >
        {status.type === 'uploading' ? (
          <div className="flex flex-col items-center gap-2">
            <svg
              className="animate-spin h-6 w-6 text-violet-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-neutral-500">Indexando FAQ...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg
              className={`h-7 w-7 transition-colors ${isDragOver ? 'text-violet-400' : 'text-neutral-300'}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <p className="text-sm text-neutral-500">
              Arraste um{' '}
              <code className="text-xs bg-neutral-100 border border-neutral-200 px-1 py-0.5 rounded font-mono">
                .md
              </code>{' '}
              ou{' '}
              <span className="font-medium text-violet-600">clique para selecionar</span>
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".md"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {status.type === 'success' && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <svg
            className="shrink-0 h-4 w-4 text-green-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-green-700">
            <span className="font-medium">{status.chunkCount}</span>{' '}
            {status.chunkCount === 1 ? 'seção indexada' : 'seções indexadas'} —{' '}
            <span className="font-mono text-xs">{status.filename}</span>
          </p>
        </div>
      )}

      {status.type === 'error' && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <svg
            className="shrink-0 mt-0.5 h-4 w-4 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700">{status.message}</p>
        </div>
      )}
    </div>
  )
}
