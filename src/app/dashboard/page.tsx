import Link from 'next/link'
import MetricsDashboard from '@/components/MetricsDashboard'

export default function DashboardPage() {
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
          Métricas
        </span>
        <div className="flex-1" />
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-neutral-700 font-medium"
        >
          ← Voltar ao chat
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-6 bg-neutral-50">
        <MetricsDashboard />
      </main>
    </div>
  )
}
