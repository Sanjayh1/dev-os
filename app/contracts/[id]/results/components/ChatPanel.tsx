'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useChatHistory } from './useChatHistory'
import { useSendChatMessage } from './useSendChatMessage'
import { ChatMessage, type ChatContextType } from './ChatMessage'

// Spec: docs/specs/contract-chat.md
// Floating-button trigger from the results page. History loads via React
// Query on open; the in-flight user message + assistant response are
// appended optimistically to local state and reconciled once the mutation
// resolves. A failed send shows an inline error scoped to that message with
// a retry action — not a full-panel error.

const MAX_MESSAGE_LENGTH = 2000

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  contextType?: ChatContextType | null
  status: 'sent' | 'error'
}

interface ChatPanelProps {
  contractId: string
  onCitationClick: (page: number) => void
}

export function ChatPanel({ contractId, onCitationClick }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const history = useChatHistory(contractId, isOpen)
  const sendMessage = useSendChatMessage()

  useEffect(() => {
    if (history.data) {
      setMessages(
        history.data.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          contextType: m.context_type,
          status: 'sent',
        }))
      )
    }
  }, [history.data])

  function submit(message: string) {
    setPendingMessage(message)
    sendMessage.mutate(
      { contractId, message },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              id: response.message_id,
              role: 'assistant',
              content: response.content,
              contextType: response.context_type,
              status: 'sent',
            },
          ])
          setPendingMessage(null)
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { id: `error-${Date.now()}`, role: 'assistant', content: '', status: 'error' },
          ])
        },
      }
    )
  }

  function handleSend() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed, status: 'sent' },
    ])
    setDraft('')
    submit(trimmed)
  }

  function handleRetry() {
    if (!pendingMessage) return
    setMessages((prev) => prev.filter((m) => m.status !== 'error'))
    submit(pendingMessage)
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-lg right-lg flex items-center gap-xs rounded-full bg-primary px-md py-sm text-body font-semibold text-white shadow-lg transition duration-150 ease-out hover:bg-primary-hover"
      >
        <MessageCircle size={18} strokeWidth={1.5} />
        Chat with Contract
      </button>
    )
  }

  return (
    <div className="fixed bottom-lg right-lg flex h-[32rem] w-96 flex-col rounded-card border border-border bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-md py-sm">
        <p className="text-body font-semibold text-text-primary">Chat with Contract</p>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 space-y-sm overflow-y-auto p-md">
        {history.isLoading && <p className="text-small text-text-muted">Loading conversation…</p>}
        {messages.map((message) =>
          message.status === 'error' ? (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-card border border-error/30 bg-error/10 px-md py-sm text-small text-error">
                Something went wrong.{' '}
                <button type="button" onClick={handleRetry} className="font-semibold underline">
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              contextType={message.contextType}
              onCitationClick={onCitationClick}
            />
          )
        )}
        {sendMessage.isPending && <p className="text-small text-text-muted">Thinking…</p>}
      </div>

      <div className="border-t border-border p-md">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask about this contract…"
          rows={2}
          className="w-full resize-none rounded-input border border-border-strong bg-white px-sm py-xs text-body text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <div className="mt-xs flex items-center justify-between">
          <span
            className={`text-small ${
              draft.length > MAX_MESSAGE_LENGTH - 100 ? 'text-error' : 'text-text-muted'
            }`}
          >
            {draft.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            className="rounded-input bg-primary px-md py-xs text-body font-semibold text-white transition duration-150 ease-out hover:bg-primary-hover disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
