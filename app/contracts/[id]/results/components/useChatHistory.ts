'use client'

import { useQuery } from '@tanstack/react-query'

// Spec: docs/specs/contract-chat.md
// Loaded once, on chat panel open.

export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  context_type: 'contract' | 'history' | 'both' | null
  created_at: string
}

async function fetchChatHistory(contractId: string): Promise<ChatHistoryMessage[]> {
  const response = await fetch(`/api/contracts/${contractId}/chat`)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to load chat history.')
  }
  return body.messages as ChatHistoryMessage[]
}

export function useChatHistory(contractId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat-history', contractId],
    queryFn: () => fetchChatHistory(contractId),
    enabled,
  })
}
