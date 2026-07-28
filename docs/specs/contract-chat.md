# Spec: Contract Chat — Conversation Memory Layer

**Source:** engineering-doc.md §4 Flow 4, §8, §9; implementation-specs.md "Contract Chat"
**Code paths:** `app/api/contracts/[id]/chat/route.ts`, `lib/openai/prompts/chat.ts`, `app/contracts/[id]/results/components/ChatPanel.tsx`, `ChatMessage.tsx`

---

## User Flow

Results page → "Chat with Contract" (floating button or tab) → chat panel opens, loads prior messages for this contract's session (if any) → user types a question → response renders, grounded in whichever context it was actually answered from, with a `[Page X]` citation (when contract-grounded) that scrolls the active viewer to that page → a "Source: …" label attributes the answer → conversation persists and reloads on revisit, attribution included.

---

## DB Schema Touched

`chat_sessions` (create-once per contract), `chat_messages` (insert per turn — assistant rows also carry `context_type`).

---

## DB Tasks

```sql
-- On first message for a contract, if no session exists:
insert into chat_sessions (contract_id, user_id) values ($1, $2)
on conflict (contract_id) do nothing
returning id;

-- Fetch the most recent messages for classification + retrieval (see
-- Retrieval below for why this must happen before the new message is saved):
select role, content from chat_messages
where session_id = $1 order by created_at desc limit 20; -- then reverse in application code

-- After the user sends a message and the model responds:
insert into chat_messages (session_id, user_id, role, content) values ($1, $2, 'user', $3);
insert into chat_messages (session_id, user_id, role, content, context_type) values ($1, $2, 'assistant', $4, $5);
```

---

## Classification, Retrieval, and System Prompt

Every question is classified into exactly one of three context types before a response is generated:

| Context type | Meaning | Retrieval | System prompt |
|---|---|---|---|
| `contract` | Question is about the document content | Contract text + last 10 turns | `Answer only from the contract. Cite [Page X].` |
| `history` | Question is about the conversation itself | Conversation only, up to 20 turns — **no contract text** | `Answer only from the conversation. End with [From conversation].` |
| `both` | Question references both | Contract text + last 10 turns | `Answer from both. Attribute each fact to its source.` |

A "turn" is one `chat_messages` row (one user or assistant message), not a user+assistant pair.

Classification is a lightweight heuristic (`classifyQuestion` in `lib/openai/prompts/chat.ts`), not a separate model call — pattern-matching for conversation-recall phrasing ("what did I just ask", "our conversation") versus document-reference nouns (contract/clause/page/term/…) versus generic follow-up pronouns.

**Critical ordering requirement:** conversation history must be fully loaded from the database, and classification must run against it, *before* the new user message is inserted. Inserting the new message first would make it visible to the very next history fetch, so the classifier would always see it as part of the history it's meant to be classifying — misclassifying every turn. The route enforces this by loading history, classifying, calling OpenAI, and only then persisting the user + assistant rows.

---

## API Routes

### `POST /api/contracts/{id}/chat`

**Auth:** required, ownership check

**Request:** `{ "message": string }` (≤2,000 chars)

**Response `200`:**
```json
{ "message_id": "uuid", "role": "assistant", "content": "...", "context_type": "contract", "cited_pages": [4] }
```

**Errors:** `429 rate_limited`, `502 openai_chat_failed`, `504 openai_timeout`

**Server-side steps:**
1. Fetch `contracts.contract_text` (already stored — never re-download or re-parse the PDF).
2. Fetch the most recent 20 `chat_messages` (see ordering requirement above) — before any write.
3. Classify the question (`contract` / `history` / `both`).
4. Slice history to the depth the classification calls for (10 or 20 turns) and decide whether contract text is included at all.
5. Call OpenAI: model `gpt-4o`, `temperature: 0.4`, `max_tokens: 1000`, with the system prompt matched to the classification.
6. Insert the user message, then the assistant message (with `context_type`) into `chat_messages` — creating `chat_sessions` first if this is the first message.
7. Extract `cited_pages` by parsing `[Page N]` occurrences in the returned content.

### `GET /api/contracts/{id}/chat`

**Auth:** required, ownership check

**Response `200`:** `{ "messages": [{ "id": "uuid", "role": "user" | "assistant", "content": "...", "context_type": "contract" | "history" | "both" | null, "created_at": "..." }] }` — chronological, most recent 200.

---

## `lib/openai/prompts/chat.ts` Contract

```ts
type ChatContextType = 'contract' | 'history' | 'both'

function classifyQuestion(message: string, hasHistory: boolean): ChatContextType

interface ChatPromptInput {
  contextType: ChatContextType
  contractText?: string        // omitted entirely for 'history'
  history: { role: 'user' | 'assistant'; content: string }[]  // pre-sliced by the route
  message: string
}

function buildChatPrompt(input: ChatPromptInput): { system: string; messages: ChatCompletionMessage[] }
```

"I cannot find this in the document" (for `contract`/`both`) is a valid, expected response — not an error, and must not be suppressed or retried.

---

## State Management

React Query (`useChatHistory`) for the initial history load on panel open. Local state appends the in-flight user message + assistant response optimistically, reconciled once the mutation resolves. `context_type` travels with each message both from history and from a live send.

---

## Component Spec

- **`ChatPanel.tsx`** — message list + input box; floating-button or sidebar-tab trigger from the results page.
- **`ChatMessage.tsx`** — right-aligned user bubble (`#112E81` bg, white text), left-aligned assistant bubble (`#F1F5F9` bg, `#0F172A` text). Citations render as clickable page links that set `targetPage` on the active viewer (see `results-display.md`). A "Source: Contract" / "Source: Conversation" / "Source: Contract + Conversation" label attributes each assistant reply, driven by the persisted `context_type` — not re-derived from the text.

---

## Design Notes

Chat container: `#FFFFFF` background, `#E2E8F0` border. The source-attribution label is small, muted-text, below the bubble — informational, never a claim of certainty about the answer's correctness.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Question about something absent from the document | Expected valid response: "I cannot find this in the document." — covered by the automated hallucination regression test (engineering-doc.md §13) |
| OpenAI timeout/failure | Inline error bubble with a retry action scoped to that specific message, not a full-page error |
| Message > 2,000 chars | Blocked client-side with a live character counter |
| Rate limit hit (Stage 7 rate limiter) | `429` → "You're sending messages too quickly — please wait a moment" |
| Contract's PDF deleted (90-day retention) but `contract_text` remains | `contract`/`both` questions continue to work — text is the source of truth; only `PdfViewer` is affected, `TextViewer` still renders |
| First message in a session | Always classified `contract` — there is no history yet to classify against |
