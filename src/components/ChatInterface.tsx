'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatRequest, Message } from '@/types'

type ChatStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; messageId: string; retrievedChunks: string[]; timing: unknown }
  | { type: 'error'; error: string }

/**
 * Lê o corpo da resposta como NDJSON (uma linha = um evento JSON), chamando
 * `onEvent` para cada linha completa recebida. Trata quebras de linha que
 * caem no meio de um chunk de rede mantendo um buffer entre leituras.
 */
async function consumeNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      onEvent(JSON.parse(line) as ChatStreamEvent)
    }
  }
}

const EXAMPLE_QUESTIONS = [
  'Como configuro o ambiente local?',
  'Qual é o processo para abrir um PR?',
  'Como solicito acesso às ferramentas?',
]

function createMessage(role: Message['role'], content: string, isError?: boolean, metricId?: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    isError,
    metricId,
  }
}

function friendlyError(status: number, serverMsg: string): string {
  if (status === 400 && serverMsg.toLowerCase().includes('faq')) {
    return 'Nenhuma FAQ carregada ainda. Faça o upload de um arquivo .md no painel ao lado para começar.'
  }
  if (status === 500) {
    return 'Ocorreu um erro no servidor. Verifique se o Ollama está rodando e o modelo phi3 foi baixado.'
  }
  return serverMsg || 'Erro ao obter resposta.'
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({})
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [showEndModal, setShowEndModal] = useState(false)
  const [sessionResolved, setSessionResolved] = useState<boolean | undefined>(undefined)
  const [sessionScore, setSessionScore] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined)
  const [isSubmittingSession, setIsSubmittingSession] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(textOverride?: string) {
    const text = (textOverride !== undefined ? textOverride : input).trim()
    if (!text || isLoading) return

    if (!sessionStartedAt) setSessionStartedAt(new Date().toISOString())
    const userMsg = createMessage('user', text)
    const historySnapshot = messages

    setMessages((prev) => [...prev, userMsg])
    if (textOverride === undefined) setInput('')
    setIsLoading(true)
    inputRef.current?.focus()

    const assistantMsg = createMessage('assistant', '')
    setMessages((prev) => [...prev, assistantMsg])

    function updateAssistant(patch: Partial<Message>) {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, ...patch } : m)))
    }

    function appendToAssistant(text: string) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + text } : m))
      )
    }

    try {
      const body: ChatRequest = { message: text, history: historySnapshot, sessionId }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        updateAssistant({ content: friendlyError(res.status, data.error), isError: true })
        return
      }

      if (!res.body) throw new Error('Resposta sem corpo')

      await consumeNdjsonStream(res.body, (event) => {
        if (event.type === 'chunk') {
          appendToAssistant(event.text)
        } else if (event.type === 'done') {
          updateAssistant({ metricId: event.messageId })
        } else if (event.type === 'error') {
          updateAssistant({ content: event.error || 'Erro ao gerar resposta.', isError: true })
        }
      })
    } catch {
      updateAssistant({
        content: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
        isError: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handleEndSession() {
    setIsSubmittingSession(true)
    const endedAt = new Date().toISOString()
    const userMessageCount = messages.filter((m) => m.role === 'user').length

    try {
      await fetch('/api/metrics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          startedAt: sessionStartedAt ?? endedAt,
          endedAt,
          userMessageCount,
          ...(sessionResolved !== undefined && { resolved: sessionResolved }),
          ...(sessionScore !== undefined && { satisfactionScore: sessionScore }),
        }),
      })
    } catch {
      // best-effort — falha silenciosa
    }

    setMessages([])
    setSessionId(crypto.randomUUID())
    setFeedbackGiven({})
    setSessionStartedAt(null)
    setSessionResolved(undefined)
    setSessionScore(undefined)
    setShowEndModal(false)
    setIsSubmittingSession(false)
  }

  async function handleFeedback(metricId: string, value: 'positive' | 'negative') {
    setFeedbackGiven((prev) => ({ ...prev, [metricId]: value }))
    try {
      await fetch('/api/metrics/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: metricId, sessionId, value }),
      })
    } catch {
      // best-effort — falha silenciosa
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">

        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-5 mt-10 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-violet-500"
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
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700">Olá! Sou o OnboardBot.</p>
              <p className="text-sm text-neutral-400 mt-1">
                Carregue uma FAQ no painel ao lado e faça sua pergunta.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="text-xs border border-neutral-200 rounded-full px-3 py-1.5 text-neutral-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages
          .filter((msg) => !(isLoading && msg.role === 'assistant' && !msg.isError && msg.content === ''))
          .map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.isError ? (
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
                <svg
                  className="shrink-0 mt-0.5 h-4 w-4 text-red-400"
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
                <span>{msg.content}</span>
              </div>
            ) : msg.role === 'user' ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-violet-600 text-white whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-1 max-w-[80%]">
                <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-neutral-100 text-neutral-800 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_code]:bg-neutral-200 [&_code]:border [&_code]:border-neutral-300 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mt-1 [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mt-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.metricId && (
                  <div className="flex items-center gap-0.5 pl-1">
                    {(['positive', 'negative'] as const).map((val) => {
                      const voted = feedbackGiven[msg.metricId!]
                      const isSelected = voted === val
                      const isVoted = voted !== undefined
                      return (
                        <button
                          key={val}
                          onClick={() => handleFeedback(msg.metricId!, val)}
                          disabled={isVoted}
                          aria-label={val === 'positive' ? 'Resposta útil' : 'Resposta não útil'}
                          className={`rounded p-1 transition-colors disabled:cursor-default ${
                            isSelected
                              ? val === 'positive'
                                ? 'text-green-500'
                                : 'text-red-400'
                              : isVoted
                              ? 'text-neutral-200'
                              : 'text-neutral-300 hover:text-neutral-500'
                          }`}
                        >
                          {val === 'positive' ? (
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V2.75a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48a4.53 4.53 0 01-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 01-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.487 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 011.423.23l3.114 1.04a4.5 4.5 0 001.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.75 2.25 2.25 0 009.75 22a.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 00.303-.54" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (messages.at(-1)?.content ?? '') === '' && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
              </span>
              <span className="text-sm text-neutral-400">Digitando...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-200 bg-white">
        {messages.length > 0 && (
          <div className="px-4 pt-2.5 flex justify-end">
            <button
              onClick={() => setShowEndModal(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Encerrar conversa
            </button>
          </div>
        )}
        <div className="p-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta... (Enter para enviar)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-shadow disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="shrink-0 rounded-xl bg-violet-600 p-2.5 text-white disabled:opacity-40 hover:bg-violet-700 active:scale-95 transition-all"
            aria-label="Enviar mensagem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-neutral-800">Encerrar conversa</h2>

            <div className="flex flex-col gap-2.5">
              <p className="text-sm text-neutral-600">Sua dúvida foi resolvida?</p>
              <div className="flex gap-2">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setSessionResolved(sessionResolved === val ? undefined : val)}
                    className={`flex-1 rounded-lg border py-1.5 text-sm transition-colors ${
                      sessionResolved === val
                        ? val
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-red-50 border-red-300 text-red-700'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                    }`}
                  >
                    {val ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-sm text-neutral-600">
                Como você avalia sua experiência?{' '}
                <span className="text-neutral-400">(opcional)</span>
              </p>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as const).map((star) => (
                  <button
                    key={star}
                    onClick={() => setSessionScore(sessionScore === star ? undefined : star)}
                    aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                    className={`text-2xl leading-none transition-colors ${
                      star <= (sessionScore ?? 0)
                        ? 'text-amber-400'
                        : 'text-neutral-200 hover:text-amber-200'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEndSession}
                disabled={isSubmittingSession}
                className="px-4 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {isSubmittingSession ? 'Encerrando...' : 'Encerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
