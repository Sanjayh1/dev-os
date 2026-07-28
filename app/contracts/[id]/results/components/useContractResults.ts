'use client'

import { useQuery } from '@tanstack/react-query'

// Spec: docs/specs/results-display.md
// Fetches GET /api/contracts/{id}.

export interface KeyTermData {
  id: string
  term_name: string
  value: string
  page_number: number
  confidence_score: number
  source_sentence: string
  is_custom: boolean
  is_edited: boolean
}

export interface CustomTermData {
  id: string
  term_name: string
}

export interface ContractResultsResponse {
  contract: {
    id: string
    file_name: string
    contract_type: 'NDA' | 'MSA'
    page_count: number
    status: 'uploaded' | 'processing' | 'completed' | 'error'
    contract_text: string | null
  }
  key_terms: KeyTermData[]
  custom_terms: CustomTermData[]
  signed_url: string | null
}

async function fetchContractResults(contractId: string): Promise<ContractResultsResponse> {
  const response = await fetch(`/api/contracts/${contractId}`)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Failed to load contract.')
  }
  return body as ContractResultsResponse
}

export function useContractResults(contractId: string) {
  return useQuery({
    queryKey: ['contract-results', contractId],
    queryFn: () => fetchContractResults(contractId),
  })
}
