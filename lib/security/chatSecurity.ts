import type { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/errors'

type SupabaseClient = ReturnType<typeof createClient>

// Wraps the RLS-scoped "select ... where id = X" pattern already used across
// contract/chat routes into a single reusable check with a consistent
// 404 on failure — used by every route that touches a specific contract or
// chat session, not just chat.

export async function verifyContractOwnership(supabase: SupabaseClient, contractId: string, columns: string) {
  const { data: contract, error } = await supabase.from('contracts').select(columns).eq('id', contractId).single()

  if (error || !contract) {
    return { contract: null, response: apiError(404, 'contract_not_found', 'Contract not found.') }
  }
  return { contract, response: null }
}

export async function verifySessionOwnership(supabase: SupabaseClient, sessionId: string) {
  const { data: session, error } = await supabase.from('chat_sessions').select('id').eq('id', sessionId).single()

  if (error || !session) {
    return { session: null, response: apiError(404, 'session_not_found', 'Chat session not found.') }
  }
  return { session, response: null }
}
