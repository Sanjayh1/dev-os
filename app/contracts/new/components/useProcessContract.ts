'use client'

import { useMutation } from '@tanstack/react-query'

// Spec: docs/specs/key-term-extraction.md
// React Query mutation triggering POST /api/contracts/{id}/process.

export interface KeyTermResult {
  id: string
  term_name: string
  value: string
  page_number: number
  confidence_score: number
  source_sentence: string
  is_custom: boolean
}

export interface ProcessContractResponse {
  status: 'completed' | 'processing'
  key_terms: KeyTermResult[]
}

async function processContract(contractId: string): Promise<ProcessContractResponse> {
  const response = await fetch(`/api/contracts/${contractId}/process`, {
    method: 'POST',
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Processing failed. Please try again.')
  }
  return body as ProcessContractResponse
}

export function useProcessContract() {
  return useMutation({ mutationFn: processContract })
}
