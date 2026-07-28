'use client'

import { useMutation } from '@tanstack/react-query'

// Spec: docs/specs/feedback.md

interface SubmitFeedbackInput {
  contractId: string
  rating: 'up' | 'down'
  comment?: string
}

async function submitFeedback({ contractId, rating, comment }: SubmitFeedbackInput): Promise<{ id: string }> {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract_id: contractId, rating, comment }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to submit feedback.')
  }
  return body as { id: string }
}

export function useSubmitFeedback() {
  return useMutation({ mutationFn: submitFeedback })
}
