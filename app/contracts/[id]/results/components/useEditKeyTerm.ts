'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ContractResultsResponse } from './useContractResults'

// Spec: docs/specs/inline-editing.md
// Optimistic update on the key_terms row; rollback on failure. Must complete
// ≤2s (PRD constraint) — no artificial UI delay, so this just fires straight
// through with an optimistic cache write.

interface EditKeyTermInput {
  keyTermId: string
  value: string
}

interface EditKeyTermResponse {
  id: string
  value: string
  is_edited: boolean
  original_ai_value: string
}

async function editKeyTerm({ keyTermId, value }: EditKeyTermInput): Promise<EditKeyTermResponse> {
  const response = await fetch(`/api/key-terms/${keyTermId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to save your edit.')
  }
  return body as EditKeyTermResponse
}

export function useEditKeyTerm(contractId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['contract-results', contractId]

  return useMutation({
    mutationFn: editKeyTerm,
    onMutate: async ({ keyTermId, value }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ContractResultsResponse>(queryKey)

      if (previous) {
        queryClient.setQueryData<ContractResultsResponse>(queryKey, {
          ...previous,
          key_terms: previous.key_terms.map((term) =>
            term.id === keyTermId ? { ...term, value, is_edited: true } : term
          ),
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
