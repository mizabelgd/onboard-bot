'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatRequest, ChatResponse, Message } from '@/types'

const EXAMPLE_QUESTIONS = [
  'Como configuro o ambiente local?',
  'Qual é o processo para abrir um PR?',
  'Como solicito acesso às ferramentas?',
]

function createMessage(role: Message['role'], content: string, isError?: boolean): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    isError,
  }
}

function friendlyError(status: number, serverMsg: string): string {
  if (status === 400 && serverMsg.toLowerCase().includes('faq')) {
    return 'Nenhuma FAQ carregada ainda. Faça o upload de um arquivo .md no painel ao lado para começar.'
  }
  if (status === 500) {
    return 'Ocorreu um erro no servidor. Se o problema persistir, verifique se a GEMINI_API_KEY está configurada corretamente.'
  }
  return serverMsg || 'Erro ao obter resposta.'
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(textOverride?: string) {
    const text = (textOverride !== undefined ? textOverride : input).trim()
    if (!text || isLoading) return

    const userMsg = createMessage('user', text)
    const historySnapshot = messages

    setMessages((prev) => [...prev, userMsg])
    if (textOverride === undefined) setInput('')
    setIsLoading(true)
    inputRef.current?.focus()

    try {
      const body: ChatRequest = { message: text, history: historySnapshot }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as ChatResponse | { error: string }

      if (!res.ok) {
        const serverMsg = 'error' in data ? data.error : ''
        setMessages((prev) => [
          ...prev,
          createMessage('assistant', friendlyError(res.status, serverMsg), true),
        ])
        return
      }

      setMessages((prev) => [...prev, createMessage('assistant', (data as ChatResponse).answer)])
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
          true
        ),
      ])
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

        {messages.map((msg) => (
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
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-neutral-100 text-neutral-800 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_code]:bg-neutral-200 [&_code]:border [&_code]:border-neutral-300 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mt-1 [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mt-1">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
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

      <div className="border-t border-neutral-200 p-3 flex gap-2 items-end bg-white">
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
  )
}
