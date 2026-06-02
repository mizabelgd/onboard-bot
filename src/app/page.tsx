'use client'

import { useState } from 'react'
import FAQUpload from '@/components/FAQUpload'
import FAQViewer from '@/components/FAQViewer'
import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col flex-1">
      <header className="shrink-0 border-b border-neutral-200 px-6 py-3 flex items-center gap-3">
        <h1 className="text-base font-semibold text-neutral-800">OnboardBot</h1>
        <span className="text-xs text-neutral-400">FAQ · RAG · Gemini Flash</span>
      </header>

      <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
        <aside className="shrink-0 md:w-80 lg:w-96 flex flex-col gap-5 p-4 border-b md:border-b-0 md:border-r border-neutral-200 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Base de Conhecimento
            </h2>
            <FAQUpload onUploadSuccess={() => setRefreshKey((k) => k + 1)} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              FAQ Ativa
            </h2>
            <FAQViewer refreshKey={refreshKey} />
          </section>
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface />
        </section>
      </main>
    </div>
  )
}
