'use client'

import { useRef, useState } from 'react'
import type { UploadResponse } from '@/types'

type Status =
  | { type: 'idle' }
  | { type: 'uploading' }
  | { type: 'success'; chunkCount: number; filename: string }
  | { type: 'error'; message: string }

interface FAQUploadProps {
  onUploadSuccess?: () => void
}

export default function FAQUpload({ onUploadSuccess }: FAQUploadProps) {
  const [status, setStatus] = useState<Status>({ type: 'idle' })
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
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors select-none ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : status.type === 'uploading'
              ? 'border-neutral-200 bg-neutral-50 pointer-events-none'
              : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <p className="text-sm text-neutral-600">
          {status.type === 'uploading' ? (
            'Indexando...'
          ) : (
            <>
              Arraste um <code className="text-xs bg-neutral-100 px-1 rounded">.md</code> aqui ou{' '}
              <span className="font-medium text-blue-600">clique para selecionar</span>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".md"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {status.type === 'success' && (
        <p className="text-sm text-green-700">
          ✓ {status.chunkCount} {status.chunkCount === 1 ? 'seção indexada' : 'seções indexadas'} —{' '}
          <span className="font-mono text-xs">{status.filename}</span>
        </p>
      )}

      {status.type === 'error' && (
        <p className="text-sm text-red-600">{status.message}</p>
      )}
    </div>
  )
}
