import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/security/authGuard'
import { keyTermPatchBodySchema, validateBody } from '@/lib/security/inputValidator'

// Spec: docs/specs/inline-editing.md
// PATCH /api/key-terms/{id} — inline correction of an extracted term
//
// original_ai_value must be captured from the row's CURRENT value before the
// update runs (read-then-write) — it is only ever set once, preserving the
// true AI baseline even if the term is edited again later.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const keyTermId = params.id
  const { supabase, response } = await requireAuth()
  if (response) return response

  const body = await request.json().catch(() => null)
  const validation = validateBody(keyTermPatchBodySchema, body)
  const newValue = validation.success ? validation.data!.value.trim() : ''

  if (!newValue) {
    return apiError(400, 'invalid_value', 'Value cannot be empty.')
  }

  const { data: existing, error: fetchError } = await supabase
    .from('key_terms')
    .select('id, value, original_ai_value, contract_id, term_name')
    .eq('id', keyTermId)
    .single()

  if (fetchError || !existing) {
    return apiError(404, 'term_not_found', 'Key term not found.')
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('contract_type')
    .eq('id', existing.contract_id)
    .single()

  if (contractError || !contract) {
    return apiError(500, 'key_term_update_failed', 'Failed to save your edit. Please try again.')
  }

  const originalAiValue: string = existing.original_ai_value ?? existing.value

  const { error: updateError } = await supabase
    .from('key_terms')
    .update({
      value: newValue,
      is_edited: true,
      original_ai_value: originalAiValue,
    })
    .eq('id', keyTermId)

  if (updateError) {
    return apiError(500, 'key_term_update_failed', 'Failed to save your edit. Please try again.')
  }

  await supabase.from('term_corrections').insert({
    key_term_id: keyTermId,
    contract_type: contract.contract_type,
    term_name: existing.term_name,
    ai_value: originalAiValue,
    corrected_value: newValue,
  })

  return NextResponse.json({
    id: keyTermId,
    value: newValue,
    is_edited: true,
    original_ai_value: originalAiValue,
  })
}
