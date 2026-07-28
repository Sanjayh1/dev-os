import { randomUUID } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { extractText } from '@/lib/pdf/extractText'
import { estimateTokenCount } from '@/lib/tokens/estimateTokens'
import { STANDARD_TERMS, type ContractType } from '@/lib/terms/standardTerms'
import { requireAuth } from '@/lib/security/authGuard'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rateLimiter'
import { validateFileUpload } from '@/lib/security/inputValidator'
import { MAX_PAGE_COUNT, MIN_EXTRACTED_WORD_COUNT } from '@/lib/security/tokenLimiter'

// Spec: docs/specs/upload-extraction.md
// POST /api/contracts/upload — multipart/form-data { file, contract_type }

const MAX_TOKENS = 15000

function isContractType(value: FormDataEntryValue | null): value is ContractType {
  return value === 'NDA' || value === 'MSA'
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth()
  if (response) return response

  const rateLimit = await checkRateLimit({ userId: user.id }, 'upload')
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const contractType = formData.get('contract_type')

  if (!(file instanceof File)) {
    return apiError(400, 'invalid_file_type', 'Only PDF files are supported.')
  }

  const fileValidation = validateFileUpload(file)
  if (!fileValidation.valid) {
    return apiError(400, fileValidation.code!, fileValidation.message!)
  }
  if (!isContractType(contractType)) {
    return apiError(400, 'invalid_contract_type', 'contract_type must be NDA or MSA.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const contractId = randomUUID()

  // Storage upload is non-blocking — failures leave file_path null and the
  // contract row is still created (see spec Edge Cases).
  let filePath: string | null = null
  const storagePath = `${user.id}/${contractId}/${file.name}`
  const { error: storageError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })
  if (!storageError) {
    filePath = storagePath
  }

  let extracted
  try {
    extracted = await extractText(buffer)
  } catch {
    return apiError(
      500,
      'pdf_read_failed',
      "We couldn't read this PDF — please check the file and try again."
    )
  }

  if (extracted.wordCount < MIN_EXTRACTED_WORD_COUNT) {
    return apiError(
      400,
      'scanned_pdf_unsupported',
      'This PDF appears to be scanned or has no extractable text.'
    )
  }
  if (extracted.pageCount > MAX_PAGE_COUNT) {
    return apiError(400, 'too_many_pages', 'This contract exceeds the 20-page limit for MVP support.')
  }

  const tokenCount = estimateTokenCount(extracted.text)
  if (tokenCount > MAX_TOKENS) {
    return apiError(
      400,
      'token_limit_exceeded',
      'This contract is too long for MVP support (max ~20 pages)'
    )
  }

  const { error: insertError } = await supabase.from('contracts').insert({
    id: contractId,
    user_id: user.id,
    contract_type: contractType,
    file_name: file.name,
    file_path: filePath,
    contract_text: extracted.text,
    page_count: extracted.pageCount,
    token_count: tokenCount,
    status: 'uploaded',
  })

  if (insertError) {
    return apiError(500, 'contract_insert_failed', 'Failed to save the contract. Please try again.')
  }

  return NextResponse.json(
    {
      contract_id: contractId,
      page_count: extracted.pageCount,
      token_count: tokenCount,
      standard_terms_preview: STANDARD_TERMS[contractType],
    },
    { status: 201 }
  )
}
