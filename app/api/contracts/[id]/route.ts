import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/security/authGuard'

// Spec: docs/specs/results-display.md
// GET /api/contracts/{id} — fetch contract + key terms + signed viewer URL
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { supabase, response } = await requireAuth()
  if (response) return response

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, file_name, contract_type, page_count, status, contract_text, file_path')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) {
    return apiError(404, 'contract_not_found', 'Contract not found.')
  }

  const { data: keyTerms } = await supabase
    .from('key_terms')
    .select('id, term_name, value, page_number, confidence_score, source_sentence, is_custom, is_edited')
    .eq('contract_id', contractId)

  const { data: customTerms } = await supabase
    .from('custom_key_terms')
    .select('id, term_name')
    .eq('contract_id', contractId)

  let signedUrl: string | null = null
  if (contract.file_path) {
    try {
      const { data: signed, error: signedError } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 3600)
      if (!signedError) {
        signedUrl = signed.signedUrl
      }
    } catch {
      signedUrl = null
    }
  }

  await supabase
    .from('contracts')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', contractId)

  const { file_path: _filePath, ...contractResponse } = contract

  return NextResponse.json({
    contract: contractResponse,
    key_terms: keyTerms ?? [],
    custom_terms: customTerms ?? [],
    signed_url: signedUrl,
  })
}

// Spec: engineering-doc.md §9 — DELETE /api/contracts/{id} (GDPR right-to-delete)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { supabase, response } = await requireAuth()
  if (response) return response

  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('id, file_path')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) {
    return apiError(404, 'contract_not_found', 'Contract not found.')
  }

  if (contract.file_path) {
    await supabase.storage.from('contracts').remove([contract.file_path])
  }

  const { error: deleteError } = await supabase.from('contracts').delete().eq('id', contractId)

  if (deleteError) {
    return apiError(500, 'contract_delete_failed', 'Failed to delete the contract. Please try again.')
  }

  return new NextResponse(null, { status: 204 })
}
