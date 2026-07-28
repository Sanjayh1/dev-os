'use client'

import { useMutation } from '@tanstack/react-query'
import type { ContractType } from './ContractTypeSelector'

// Spec: docs/specs/upload-extraction.md
// React Query mutation wrapping POST /api/contracts/upload.

export interface UploadContractResponse {
  contract_id: string
  page_count: number
  token_count: number
  standard_terms_preview: string[]
}

interface UploadContractInput {
  file: File
  contractType: ContractType
}

async function uploadContract({ file, contractType }: UploadContractInput): Promise<UploadContractResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('contract_type', contractType)

  const response = await fetch('/api/contracts/upload', {
    method: 'POST',
    body: formData,
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Upload failed. Please try again.')
  }
  return body as UploadContractResponse
}

export function useUploadContract() {
  return useMutation({ mutationFn: uploadContract })
}
