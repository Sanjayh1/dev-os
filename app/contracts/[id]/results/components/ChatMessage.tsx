'use client'

// Spec: docs/specs/contract-chat.md — Conversation Memory Layer
// Right-aligned user bubble, left-aligned assistant bubble. Citations render
// as clickable page links that set targetPage on the active viewer.
// contextType attributes each assistant reply to what it was actually
// answered from — persisted server-side (chat_messages.context_type) so it
// survives a reload, not just the live turn.

export type ChatContextType = 'contract' | 'history' | 'both'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  contextType?: ChatContextType | null
  onCitationClick: (page: number) => void
}

const CITATION_PATTERN = /\[Page (\d+)\]/g

const SOURCE_LABEL: Record<ChatContextType, string> = {
  contract: 'Source: Contract',
  history: 'Source: Conversation',
  both: 'Source: Contract + Conversation',
}

interface ContentPart {
  text: string
  page?: number
}

function splitCitations(text: string): ContentPart[] {
  const parts: ContentPart[] = []
  let lastIndex = 0
  const pattern = new RegExp(CITATION_PATTERN)
  let match = pattern.exec(text)
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) })
    }
    parts.push({ text: match[0], page: Number(match[1]) })
    lastIndex = match.index + match[0].length
    match = pattern.exec(text)
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) })
  }
  return parts
}

export function ChatMessage({ role, content, contextType, onCitationClick }: ChatMessageProps) {
  const isUser = role === 'user'
  const parts = splitCitations(content)

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-card px-md py-sm text-body ${
          isUser ? 'bg-primary text-white' : 'bg-surface text-text-primary'
        }`}
      >
        {parts.map((part, i) =>
          part.page != null ? (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick(part.page!)}
              className={`font-semibold underline ${isUser ? 'text-white' : 'text-primary'}`}
            >
              {part.text}
            </button>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </div>
      {!isUser && contextType && (
        <span className="mt-xs text-small text-text-muted">{SOURCE_LABEL[contextType]}</span>
      )}
    </div>
  )
}
