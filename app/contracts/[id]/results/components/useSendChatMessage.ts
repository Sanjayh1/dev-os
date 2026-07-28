'use client'

import { useMutation } from '@tanstack/react-query'

// Spec: docs/specs/contract-chat.md
// The user+assistant messages are only persisted server-side after the
// OpenAI call succeeds, so a failed send leaves nothing to reconcile —
// retrying just resubmits the same message.

export interface SendChatMessageResponse {
  message_id: string
  role: 'assistant'
  content: string
  context_type: 'contract' | 'history' | 'both'
  cited_pages: number[]
}

interface SendChatMessageInput {
  contractId: string
  message: string
}

async function sendChatMessage({ contractId, message }: SendChatMessageInput): Promise<SendChatMessageResponse> {
  const response = await fetch(`/api/contracts/${contractId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to get a response.')
  }
  return body as SendChatMessageResponse
}

export function useSendChatMessage() {
  return useMutation({ mutationFn: sendChatMessage })
}
