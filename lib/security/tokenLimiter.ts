// Consolidated file size / page count / message length / chat history
// constants, referenced by every route that previously hardcoded its own
// copy (app/api/contracts/upload, app/api/contracts/[id]/chat).
//
// Deviates from the security-foundation skill's generic template defaults —
// this product already has deliberately-scoped MVP limits baked into its own
// specs (docs/specs/upload-extraction.md, contract-chat.md) and its DB
// schema (chat_messages.content has CHECK (char_length(content) <= 2000),
// which rejects anything larger regardless of what application code
// permits). Widening these to the skill's generic numbers would silently
// contradict the product's stated scope or start failing DB writes, not
// make it safer — so the product's real values are kept here, deviations
// noted per constant.

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB, matches the storage bucket assumption

// Skill template default: 200 pages. This product's MVP scope is explicitly
// "up to ~20 pages" (upload-extraction.md) — kept as-is.
export const MAX_PAGE_COUNT = 20

// Skill template default: 5000 characters. chat_messages.content is
// CHECK-constrained to 2000 in the DB — kept in sync with that constraint.
export const MAX_MESSAGE_LENGTH = 2000

export const MIN_EXTRACTED_WORD_COUNT = 100 // below this, treated as a scanned/unreadable PDF

// Ceiling for the 'history' classification path in
// lib/openai/prompts/chat.ts. The skill suggests a default of 100; this
// product's Conversation Memory Layer already scopes 'contract'/'both'
// questions to a fixed, smaller 10-turn window, so a 100-turn ceiling for
// 'history' would be a much larger surface than anything else in the
// feature — default kept at 20 (its existing hardcoded value) unless
// explicitly overridden.
export const MAX_CHAT_HISTORY_TURNS = Number(process.env.MAX_CHAT_HISTORY ?? 20)

export function isFileSizeAllowed(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_FILE_SIZE_BYTES
}

export function isPageCountAllowed(pageCount: number): boolean {
  return pageCount <= MAX_PAGE_COUNT
}

export function isMessageLengthAllowed(length: number): boolean {
  return length > 0 && length <= MAX_MESSAGE_LENGTH
}
