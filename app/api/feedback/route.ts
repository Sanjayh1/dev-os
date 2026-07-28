import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/security/authGuard'
import { verifyContractOwnership } from '@/lib/security/chatSecurity'
import { feedbackBodySchema, validateBody } from '@/lib/security/inputValidator'

// Spec: docs/specs/feedback.md
// POST /api/feedback — thumbs up/down + optional comment (P2)

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth()
  if (response) return response

  const body = await request.json().catch(() => null)
  const validation = validateBody(feedbackBodySchema, body)
  if (!validation.success) {
    return apiError(400, 'invalid_feedback', validation.error ?? 'contract_id and rating are required.')
  }
  const { contract_id: contractId, rating, comment } = validation.data!

  const { response: ownershipResponse } = await verifyContractOwnership(supabase, contractId, 'id')
  if (ownershipResponse) return ownershipResponse

  const { data: inserted, error: insertError } = await supabase
    .from('user_feedback')
    .insert({
      user_id: user.id,
      contract_id: contractId,
      rating,
      comment: comment || null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return apiError(500, 'feedback_insert_failed', 'Failed to submit feedback. Please try again.')
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 })
}
