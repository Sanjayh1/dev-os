'use client'

import { useMutation } from '@tanstack/react-query'

// Spec: docs/specs/custom-terms.md
// React Query mutation wrapping POST /api/contracts/{id}/custom-terms.
// Called once with the full draft list, immediately before /process.

export interface CustomTermResult {
  id: string
  term_name: string
}

interface AddCustomTermsInput {
  contractId: string
  terms: string[]
}

async function addCustomTerms({ contractId, terms }: AddCustomTermsInput): Promise<CustomTermResult[]> {
  const response = await fetch(`/api/contracts/${contractId}/custom-terms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to save custom terms.')
  }
  return body.custom_terms as CustomTermResult[]
}

export function useAddCustomTerms() {
  return useMutation({ mutationFn: addCustomTerms })
}
