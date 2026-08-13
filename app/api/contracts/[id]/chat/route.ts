import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/errors'
import { azure } from '@/lib/azure'
import { buildChatPrompt, classifyQuestion, type ChatHistoryMessage } from '@/lib/openai/prompts/chat'
import { requireAuth } from '@/lib/security/authGuard'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rateLimiter'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { MAX_MESSAGE_LENGTH } from '@/lib/security/tokenLimiter'

// Spec: docs/specs/contract-chat.md — Conversation Memory Layer
// POST /api/contracts/{id}/chat — send a message, get a grounded response
//
// Calls an Azure AI Foundry agent (Responses API), not OpenAI chat
// completions. The agent has its own model + system prompt configured in
// the portal, so no model/instructions fields are sent here — see
// lib/azure.ts and skills/azure-ai-foundry/skill.md.
export const runtime = 'nodejs'
export const maxDuration = 60

// "Turn" = one chat_messages row (one user or assistant message).
const CONTRACT_CONTEXT_TURNS = 10
const HISTORY_ONLY_TURNS = 20
const MAX_HISTORY_FETCH = Math.max(CONTRACT_CONTEXT_TURNS, HISTORY_ONLY_TURNS)
const GET_HISTORY_LIMIT = 200

async function getOrCreateSession(
  supabase: ReturnType<typeof createClient>,
  contractId: string,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contractId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert({ contract_id: contractId, user_id: userId })
    .select('id')
    .single()

  if (created) return created.id
  if (!createError) return null

  // Concurrent creation race (unique on contract_id) — re-read the winner's row.
  const { data: afterRace } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contractId)
    .maybeSingle()

  return afterRace?.id ?? null
}

function extractCitedPages(content: string): number[] {
  const matches = Array.from(content.matchAll(/\[Page (\d+)\]/g))
  const pages = new Set(matches.map((match) => Number(match[1])))
  return Array.from(pages).sort((a, b) => a - b)
}

// The Azure agent rejects a system field and only accepts a single input
// message (skill §4), so the system prompt + conversation history + new
// question are all flattened into one string here instead of being sent as
// separate roles.
function buildAgentInput(system: string, messages: ChatHistoryMessage[]): string {
  const transcript = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
  return `${system}\n\n${transcript}`
}

function extractResponseText(response: unknown): string {
  const result = response as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }
  if (typeof result.output_text === 'string') return result.output_text
  const message = result.output?.find((item) => item.type === 'message')
  const textPart = message?.content?.find((part) => part.type === 'output_text')
  return textPart?.text ?? ''
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { user, supabase, response } = await requireAuth()
  if (response) return response

  const rateLimit = await checkRateLimit({ userId: user.id }, 'chat')
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contract_text, status')
    .eq('id', contractId)
    .single()

  // 404 for both "doesn't exist / not yours" and "not ready to chat about" —
  // per skill §6, chat is only allowed once extraction has completed, and we
  // don't distinguish that from not-found in the response either.
  if (contractError || !contract || contract.status !== 'completed') {
    return apiError(404, 'contract_not_found', 'Contract not found.')
  }

  const body = await request.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return apiError(400, 'invalid_message', `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`)
  }

  const injectionCheck = sanitizeForLLM(message)
  if (!injectionCheck.safe) {
    return apiError(400, 'prompt_injection', 'This message could not be sent. Please rephrase your question.')
  }

  const sessionId = await getOrCreateSession(supabase, contractId, user.id)
  if (!sessionId) {
    return apiError(500, 'chat_session_failed', 'Failed to start a chat session. Please try again.')
  }

  // CRITICAL: history must be fully loaded here, before the new user message
  // is ever inserted. Insert first and this fetch would pick the new message
  // back up as "history", so classifyQuestion would always see it as part of
  // the conversation it's meant to be classifying — misclassifying every turn.
  //
  // DESC + limit then reverse, not ASC + limit — a straight ascending fetch
  // with a limit returns the OLDEST rows once a conversation passes the cap,
  // not the most recent ones, which is the opposite of what "last N turns" means.
  const { data: recentDesc } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_FETCH)

  const fullHistory: ChatHistoryMessage[] = (recentDesc ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const contextType = classifyQuestion(message, fullHistory.length > 0)

  const turnsForContext = contextType === 'history' ? HISTORY_ONLY_TURNS : CONTRACT_CONTEXT_TURNS
  const history = fullHistory.slice(-turnsForContext)
  const contractText = contextType === 'history' ? undefined : contract.contract_text ?? ''

  const prompt = buildChatPrompt({
    contextType,
    contractText,
    history,
    message,
  })

  let assistantContent: string
  try {
    // Cast to any: the OpenAI SDK's TS types require `model` on
    // responses.create, but the Azure agent rejects that field at runtime
    // since its model is configured in the portal (skill §4).
    const response = await (azure.responses as any).create({
      input: [{ role: 'user', content: buildAgentInput(prompt.system, prompt.messages) }],
    })
    assistantContent = extractResponseText(response)
  } catch (err) {
    // Real Azure error text is returned as-is — needed to diagnose
    // credential/endpoint problems (skill §4, §7).
    const message = err instanceof Error ? err.message : 'Failed to get a response from the Azure agent.'
    return apiError(502, 'azure_chat_failed', message)
  }

  // Only now, after classification has already run against the pre-existing
  // history, do we persist the new turn.
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    content: message,
  })

  const { data: assistantRow, error: assistantInsertError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: assistantContent,
      context_type: contextType,
    })
    .select('id')
    .single()

  if (assistantInsertError || !assistantRow) {
    return apiError(502, 'chat_message_save_failed', 'Failed to save the response. Please try again.')
  }

  return NextResponse.json({
    message_id: assistantRow.id,
    role: 'assistant',
    content: assistantContent,
    context_type: contextType,
    cited_pages: extractCitedPages(assistantContent),
  })
}

// GET /api/contracts/{id}/chat — load persisted chat history
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const contractId = params.id
  const { supabase, response } = await requireAuth()
  if (response) return response

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) {
    return apiError(404, 'contract_not_found', 'Contract not found.')
  }

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contractId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ messages: [] })
  }

  // Same DESC-then-reverse reasoning as the POST handler: we want the most
  // recent GET_HISTORY_LIMIT messages, not the oldest.
  const { data: messagesDesc } = await supabase
    .from('chat_messages')
    .select('id, role, content, context_type, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(GET_HISTORY_LIMIT)

  const messages = (messagesDesc ?? []).slice().reverse()

  return NextResponse.json({ messages })
}
