'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatRequest, ChatResponse, Message } from '@/types'

function createMessage(role: Message['role'], content: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
  }
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

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg = createMessage('user', text)
    const historySnapshot = messages

    setMessages((prev) => [...prev, userMsg])
    setInput('')
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
        const errorText = 'error' in data ? data.error : 'Erro ao obter resposta.'
        setMessages((prev) => [...prev, createMessage('assistant', errorText)])
        return
      }

      setMessages((prev) => [...prev, createMessage('assistant', (data as ChatResponse).answer)])
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', 'Falha na conexão. Tente novamente.'),
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
          <p className="text-sm text-neutral-400 italic text-center mt-8">
            Faça uma pergunta sobre o FAQ carregado.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 text-neutral-400 rounded-2xl rounded-bl-sm px-4 py-2 text-sm">
              Digitando...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-200 p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua pergunta... (Enter para enviar)"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 max-h-32 overflow-y-auto"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
