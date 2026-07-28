import { NextResponse, type NextRequest } from 'next/server'
import OpenAI from 'openai'
import { apiError } from '@/lib/api/errors'
import { openai } from '@/lib/openai/client'
import { buildExtractionPrompt, type ExtractedTerm } from '@/lib/openai/prompts/extraction'
import { enforceConfidenceFloor } from '@/lib/terms/confidence'
import { requireAuth } from '@/lib/security/authGuard'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rateLimiter'

// Spec: docs/specs/key-term-extraction.md
// POST /api/contracts/{id}/process — trigger OpenAI key-term extraction

const MODEL = 'gpt-4o'
const MAX_TOKENS = 2000
const TEMPERATURE = 0.1
const MAX_ATTEMPTS = 3
const BACKOFF_MS = [1000, 2000, 4000]

class UnparseableExtractionError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseTerms(content: string): ExtractedTerm[] | null {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed?.terms)) return null
    return parsed.terms as ExtractedTerm[]
  } catch {
    return null
  }
}

async function extractTerms(system: string, user: string): Promise<ExtractedTerm[]> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages,
      })
      const content = completion.choices[0]?.message?.content ?? ''
      const terms = parseTerms(content)
      if (terms) return terms

      // One corrective retry for invalid JSON, per spec — not counted against
      // the network retry budget.
      const retryMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...messages,
        { role: 'assistant', content },
        {
          role: 'user',
          content: 'Your previous response was not valid JSON. Return only the JSON array, no explanation.',
        },
      ]
      const retryCompletion = await openai.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: retryMessages,
      })
      const retryContent = retryCompletion.choices[0]?.message?.content ?? ''
      const retryTerms = parseTerms(retryContent)
      if (retryTerms) return retryTerms

      throw new UnparseableExtractionError('Model response was not valid JSON after corrective retry.')
    } catch (err) {
      if (err instanceof UnparseableExtractionError) throw err
      lastError = err
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF_MS[attempt])
      }
    }
  }

  throw lastError
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { user, supabase, response } = await requireAuth()
  if (response) return response

  const rateLimit = await checkRateLimit({ userId: user.id }, 'process')
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('id, contract_type, contract_text, status')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) {
    return apiError(404, 'contract_not_found', 'Contract not found.')
  }
  if (contract.status !== 'uploaded') {
    return apiError(422, 'contract_not_uploaded', 'This contract has already been processed or is not ready.')
  }

  await supabase.from('contracts').update({ status: 'processing' }).eq('id', contractId)

  const { data: customTermRows } = await supabase
    .from('custom_key_terms')
    .select('term_name')
    .eq('contract_id', contractId)
  const customTermNames = (customTermRows ?? []).map((row) => row.term_name)

  const prompt = buildExtractionPrompt({
    contractText: contract.contract_text ?? '',
    contractType: contract.contract_type,
    customTerms: customTermNames,
  })

  let extracted: ExtractedTerm[]
  try {
    extracted = await extractTerms(prompt.system, prompt.user)
  } catch (err) {
    const isTimeout = err instanceof OpenAI.APIConnectionTimeoutError
    const errorMessage = err instanceof Error ? err.message : 'Unknown extraction failure'
    await supabase
      .from('contracts')
      .update({ status: 'error', error_message: errorMessage })
      .eq('id', contractId)

    if (isTimeout) {
      return apiError(504, 'openai_timeout', 'The extraction request timed out. Please try again.')
    }
    return apiError(502, 'openai_extraction_failed', 'Try again in a few minutes.')
  }

  const rows = extracted.map((term) =>
    enforceConfidenceFloor({
      contract_id: contractId,
      user_id: user.id,
      term_name: term.term_name,
      value: term.value,
      page_number: term.page_number,
      confidence_score: term.confidence_score,
      source_sentence: term.source_sentence,
      is_custom: customTermNames.includes(term.term_name),
    })
  )

  const { data: inserted, error: insertError } = await supabase.from('key_terms').insert(rows).select()

  if (insertError) {
    await supabase
      .from('contracts')
      .update({ status: 'error', error_message: 'Failed to save extracted terms.' })
      .eq('id', contractId)
    return apiError(502, 'openai_extraction_failed', 'Try again in a few minutes.')
  }

  await supabase.from('contracts').update({ status: 'completed' }).eq('id', contractId)

  return NextResponse.json(
    {
      status: 'completed',
      key_terms: inserted,
    },
    { status: 200 }
  )
}
