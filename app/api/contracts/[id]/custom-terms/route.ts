import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/security/authGuard'
import { verifyContractOwnership } from '@/lib/security/chatSecurity'

// Spec: docs/specs/custom-terms.md
// POST /api/contracts/{id}/custom-terms — attach up to 5 custom terms before processing
// Called once with the full draft list, immediately before /process — not per-keystroke.
//
// customTermsBodySchema (lib/security/inputValidator.ts) documents this
// route's contract and is unit tested against it, but isn't invoked inline
// here: a strict Zod .max(5) would reject a raw payload of 6 draft strings
// outright, where this route's own clean-then-check logic instead trims and
// drops empties/over-length entries first and only rejects if what's left
// still exceeds 5 — that leniency is the documented, tested behavior
// (docs/specs/custom-terms.md), not a gap to close.

const MAX_TERMS = 5
const MAX_LENGTH = 100

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { user, supabase, response } = await requireAuth()
  if (response) return response

  const { response: ownershipResponse } = await verifyContractOwnership(supabase, contractId, 'id')
  if (ownershipResponse) return ownershipResponse

  const body = await request.json().catch(() => null)
  const rawTerms: unknown = body?.terms

  if (!Array.isArray(rawTerms) || rawTerms.length === 0) {
    return NextResponse.json({ custom_terms: [] })
  }

  const cleaned = rawTerms
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && term.length <= MAX_LENGTH)

  if (cleaned.length === 0) {
    return NextResponse.json({ custom_terms: [] })
  }
  if (cleaned.length > MAX_TERMS) {
    return apiError(400, 'max_custom_terms_exceeded', 'A contract may have at most 5 custom key terms.')
  }

  const rows = cleaned.map((term_name) => ({
    contract_id: contractId,
    user_id: user.id,
    term_name,
    is_manual: true,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('custom_key_terms')
    .insert(rows)
    .select('id, term_name')

  if (insertError) {
    if (insertError.message?.includes('max_custom_terms_exceeded')) {
      return apiError(400, 'max_custom_terms_exceeded', 'A contract may have at most 5 custom key terms.')
    }
    return apiError(500, 'custom_terms_insert_failed', 'Failed to save custom terms. Please try again.')
  }

  return NextResponse.json({ custom_terms: inserted })
}
