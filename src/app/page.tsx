'use client'

import { useState } from 'react'
import Link from 'next/link'
import FAQUpload from '@/components/FAQUpload'
import FAQViewer from '@/components/FAQViewer'
import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploadClearKey, setUploadClearKey] = useState(0)

  return (
    <div className="flex flex-col flex-1">
      <header className="shrink-0 border-b border-neutral-200 px-5 py-3 flex items-center gap-3 bg-white">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="text-sm font-semibold text-neutral-900">OnboardBot</h1>
        <span className="text-xs text-neutral-500 bg-neutral-100 rounded-full px-2.5 py-0.5 border border-neutral-200">
          FAQ · RAG · Gemini
        </span>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="text-xs text-neutral-500 hover:text-neutral-700 font-medium"
        >
          Métricas →
        </Link>
      </header>

      <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
        <aside className="shrink-0 md:w-80 lg:w-96 flex flex-col gap-6 p-4 border-b md:border-b-0 md:border-r border-neutral-200 overflow-y-auto bg-neutral-50">
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-neutral-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Base de Conhecimento
              </h2>
            </div>
            <FAQUpload
              onUploadSuccess={() => setRefreshKey((k) => k + 1)}
              resetKey={uploadClearKey}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-neutral-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                FAQ Ativa
              </h2>
            </div>
            <FAQViewer
              refreshKey={refreshKey}
              onRemove={() => {
                setRefreshKey((k) => k + 1)
                setUploadClearKey((k) => k + 1)
              }}
            />
          </section>
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden bg-white">
          <ChatInterface />
        </section>
      </main>
    </div>
  )
}
