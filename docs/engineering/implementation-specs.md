# ContractIQ — Implementation Specs

**Status:** Draft — Stage 1 Output (companion to `engineering-doc.md`)
**Source:** `docs/ContractIQ_PRD.md`, `docs/engineering/engineering-doc.md`
**Last updated:** 2026-07-25

This document breaks each MVP feature into an implementation-ready spec block: user flow, DB schema touched, DB tasks, API routes, state management, component spec, design notes, and edge cases. It is the direct input to Stage 2 (`/implementation-specs`), which will expand these into granular files under `docs/specs/` plus the runnable `database.sql` (project root) and `.env.example`.

Feature blocks are ordered to match build sequence (auth → upload → extraction → custom terms → results display → inline editing → chat → dashboard → feedback).

---

## Feature: Authentication (US-001)

**User flow:** Landing page → "Get Started Free" → Supabase Auth sign-up modal (email + password) → email verification (if enabled) → redirect to `/dashboard`. Returning users: `/login` → `signInWithPassword` → `/dashboard`.

**DB schema touched:** `auth.users` (Supabase-managed). No custom `profiles` table required at MVP — nothing beyond email/password is collected.

**DB tasks:** None beyond what Supabase Auth provisions automatically. RLS policies on all app tables reference `auth.uid()` directly against `auth.users.id`.

**API routes:** None — `supabase-js` client (`@supabase/ssr`) calls `auth.signUp()` / `auth.signInWithPassword()` / `auth.signOut()` directly from the frontend. `middleware.ts` checks session presence and redirects unauthenticated requests to `/login` for protected routes (`/dashboard`, `/contracts/*`).

**State management:** Session held in Supabase auth context (`@supabase/ssr` provider at root layout). No React Query needed — session changes trigger a router refresh.

**Component spec:**
- `app/(auth)/signup/page.tsx` — email, password, confirm-password fields; client-side validation (email format, password ≥8 chars); submit disables button + shows spinner
- `app/(auth)/login/page.tsx` — email, password; "Forgot password" link (Supabase password-reset flow, not detailed further at MVP)

**Design notes:** Follows form input spec (44px height, `#CBD5E1` border, `#112E81` focus border per `skills/design-system/SKILL.md`, the sole authoritative design system). Primary button style for "Sign Up"/"Sign In".

**Edge cases:**
- Email already registered → inline error, no generic 500
- Invalid credentials on login → generic "Invalid email or password" (do not reveal which field is wrong, to avoid user enumeration)
- Auth flow must complete ≤10s (PRD constraint) — if Supabase is slow, show a timeout-specific message rather than an indefinite spinner

---

## Feature: PDF Upload + Text Extraction (US-002, FR-02, FR-03)

**User flow:** `/contracts/new` → select contract type (NDA/MSA) → drag-and-drop or file-pick PDF → client validates size/type → submit → server extracts text → pre-processing preview of standard terms shown.

**DB schema touched:** `contracts` (insert on upload).

**DB tasks:**
- `INSERT INTO contracts (user_id, contract_type, file_name, file_path, contract_text, page_count, token_count, status)`
- `file_path` set only if Storage upload succeeds; `null` otherwise (non-blocking per PRD architecture note)
- `status` transitions: `'uploaded'` on success

**API routes:** `POST /api/contracts/upload` (see engineering-doc.md §9 for full contract). Server-side steps:
1. Validate `file` is `application/pdf`, ≤10MB
2. Upload to Supabase Storage at `contracts/{user_id}/{contract_id}/{filename}.pdf` (best-effort; catch and continue on failure)
3. Run `pdf-parse` → raw text; insert `[PAGE N]` markers at page boundaries
4. Reject if extracted word count < 100 ("Scanned PDFs are not supported yet")
5. Reject if page count > 20 or token count > 15,000
6. Insert `contracts` row, return `contract_id` + standard-term preview list for the selected type

**State management:** Local `useState` for file, upload progress, and validation errors on the client. React Query mutation (`useUploadContract`) wraps the POST call; on success, navigates to the term-preview step with `contract_id` in local state/URL.

**Component spec:**
- `ContractTypeSelector.tsx` — dropdown, NDA/MSA
- `UploadDropzone.tsx` — drag-and-drop + file picker, shows filename/size once selected, inline validation errors
- `KeyTermPreviewList.tsx` — renders the static standard-term list for the chosen type (from PRD §4 Flow 3 step 2: 10 terms for NDA, 12 for MSA) while extraction/preview loads

**Design notes:** Dropzone uses card styling (`12px` radius, `#E2E8F0` border); drag-active state uses `#AACCD6` accent border. Standard-term list uses `Body` (14px) rows with muted-text term names until values are populated post-processing.

**Edge cases:**
- File > 10MB → reject client-side before upload attempt, with exact size shown
- Non-PDF file → reject client-side
- >20 pages → reject server-side after parse (can't know page count pre-parse for all PDFs)
- Token count > 15,000 → reject with "This contract is too long for MVP support (max ~20 pages)"
- Storage upload fails but text extraction succeeds → contract still created (`status='uploaded'`, `file_path=null`); results page will use text-viewer fallback later, not blocked here
- Corrupted/unreadable PDF → catch `pdf-parse` exception, return `400` with "We couldn't read this PDF — please check the file and try again," no partial `contracts` row persisted

---

## Feature: Key Term Extraction (US-002 continued, US-003, US-004, FR-04)

**User flow:** User clicks "Process Contract" → 3-step progress indicator (extracting ✓ → analysing with AI → compiling results) → redirected to results page on completion.

**DB schema touched:** `key_terms` (bulk insert), `contracts` (status update).

**DB tasks:**
- `UPDATE contracts SET status='processing'` at call start
- Build extraction prompt from `contracts.contract_text` + standard term schema for `contract_type` + any rows in `custom_key_terms` for this contract
- Call OpenAI GPT-4o (JSON mode, temp 0.1); on parse failure, one retry with corrective prompt
- `INSERT INTO key_terms (contract_id, user_id, term_name, value, page_number, confidence_score, source_sentence, is_custom)` for each returned term
- `UPDATE contracts SET status='completed'` on success, or `status='error', error_message=...` after retries/backoff exhausted

**API routes:** `POST /api/contracts/{id}/process` (engineering-doc.md §9).

**State management:** React Query mutation triggers processing; polling or Supabase Realtime subscription on `contracts.status` drives the progress indicator's 3 steps without the client needing to guess timing.

**Component spec:**
- `ProcessingProgress.tsx` — 3-step indicator bound to `contracts.status` (`uploaded`→step 1 done, `processing`→step 2 active, `completed`→step 3 done + redirect)
- `KeyTermsPanel.tsx` / `KeyTermRow.tsx` — rendered on the results page once terms exist (see Results Display spec below)

**Design notes:** Confidence colour-coding per `skills/design-system/SKILL.md`: 90–100% `#16A34A`, 70–89% `#84CC16`, 50–69% `#F59E0B`, <50% `#DC2626`. Low-confidence rows get a non-dismissible tooltip icon, never hidden.

**Edge cases:**
- OpenAI timeout/5xx → 3-attempt retry with exponential backoff; on exhaustion, `status='error'`, user sees "Try again in a few minutes" CTA that re-triggers `/process` without re-upload
- JSON parse failure → one corrective retry prompt before surfacing an error
- Model returns fewer than expected standard terms → still store what's returned; missing terms simply don't render as rows (no fabricated placeholders)
- Confidence < 50% → ⚠️ flag + tooltip, term still shown (never hidden) per PRD hallucination guardrails
- A term with no `source_sentence` → treated as unreliable; force-cap its displayed confidence at <50% regardless of model-reported score (extra safety net beyond the prompt contract)

---

## Feature: Custom Key Term Addition (US-005, FR-05)

**User flow:** On `/contracts/new`, after upload, user clicks "+ Add Key Term", types a term name (e.g. "Non-compete radius"), it appears in the preview list with a "Custom" badge. Up to 5 allowed. Custom terms are persisted and included when "Process Contract" is clicked.

**DB schema touched:** `custom_key_terms` (insert), `key_terms` (extraction results carry `is_custom=true` for these).

**DB tasks:** `INSERT INTO custom_key_terms (contract_id, user_id, term_name, is_manual=true)` — one row per custom term, capped at 5 per `contract_id`.

**API routes:** `POST /api/contracts/{id}/custom-terms` (engineering-doc.md §9). Called either incrementally as each term is added, or in a single batch right before `/process` — batch-on-process is simpler and avoids partial state if the user abandons the flow; **recommended: batch on process trigger**.

**State management:** Local `useState` array of draft term strings on the upload page; validated client-side (max 5, non-empty, ≤100 chars, no duplicates) before being sent alongside the process request.

**Component spec:** `CustomTermInput.tsx` — text input + "Add" button, disabled once 5 terms are reached, each entry removable before processing; renders inline in `KeyTermPreviewList.tsx` with a `Badge` variant "Custom".

**Design notes:** "Custom" badge uses Secondary color (`#4647AE`) to visually distinguish from standard terms in the preview and results panel.

**Edge cases:**
- 6th term attempted → input disabled, tooltip "Maximum 5 custom terms"
- Duplicate term name (case-insensitive) → inline validation error, not sent to server
- Empty submission → "Process Contract" proceeds with zero custom terms (not required)
- Custom term not found anywhere in the contract → model returns low/zero confidence + empty value; still displayed with warning, not omitted

---

## Feature: Results Display — PDF Viewer + Text Viewer Fallback (US-006, FR-06, FR-07)

**User flow:** Results page loads with two panels — left: contract content (PDF.js viewer if a valid signed URL exists, otherwise the text-viewer fallback), right: key terms panel. Clicking a term's page number scrolls/highlights the corresponding location in whichever viewer is active.

**DB schema touched:** Read-only — `contracts` (`file_path`, `contract_text`), `key_terms`.

**DB tasks:** `SELECT` contract + terms scoped to `user_id = auth.uid()`. If `file_path` is not null, generate a 1-hour signed URL via Supabase Storage; if `file_path` is null or signed-URL generation fails, the frontend renders `TextViewer` instead — this is a first-class, not degraded, path per this document's locked-in decision.

**API routes:** `GET /api/contracts/{id}` returns `{ contract, key_terms, custom_terms, signed_url }` where `signed_url` may be `null`.

**State management:** `activeViewer: 'pdf' | 'text'` derived from `signed_url` presence (with a manual "download PDF" fallback link always available regardless, per PRD's PDF.js-compatibility risk mitigation). `targetPage: number | null` lifted to the results page and passed as a prop to whichever viewer is mounted — both viewers must react identically to changes in `targetPage` (smooth scroll + highlight).

**Component spec:**
- `ContractViewerPanel.tsx` — switch component choosing `PdfViewer` vs `TextViewer` based on `signed_url`
- `PdfViewer.tsx` — PDF.js, lazy page loading, zoom controls, accepts `targetPage` prop, highlights term-associated spans
- `TextViewer.tsx` — parses `[PAGE N]` markers from `contract_text` into labelled page sections, accepts the same `targetPage` prop, scrolls to and highlights the corresponding section; supports the same zoom-independent readable layout
- `KeyTermsPanel.tsx` / `KeyTermRow.tsx` — term name, value, page number (click → sets `targetPage`), confidence badge, expandable "Why?" showing `source_sentence`

**Design notes:** Contract viewer toolbar `#112E81` background per `skills/design-system/SKILL.md`; selected-text highlight `#AACCD6`. Key term table columns: Key Term · Value · Page Number · Confidence Score · Status, row hover `#F8FAFC`, selected row `#D8E8ED`. "Not legal advice" `Disclaimer` component rendered once at the top of every results page (PRD §9 UI guardrail).

**Edge cases:**
- Signed URL expired mid-session (>1hr) → re-request a fresh URL on viewer error rather than failing silently
- Storage bucket/policy misconfigured → `signed_url` generation throws; caught server-side, `signed_url: null` returned, text viewer used, non-blocking banner: "PDF preview unavailable — showing extracted text instead"
- Unusual PDF fonts/layout causing PDF.js render failure client-side → catch render error, offer "download PDF" link + auto-switch to text viewer
- Term's `page_number` exceeds actual `page_count` (malformed model output) → clamp to last page, do not crash the viewer

---

## Feature: Inline Key Term Editing (US-009, FR-09-adjacent)

**User flow:** User clicks a term's value in `KeyTermRow.tsx` → field becomes editable → user types correction → saves → row shows "Edited" badge; original AI value is preserved for the feedback loop.

**DB schema touched:** `key_terms` (update), `term_corrections` (insert).

**DB tasks:**
- `UPDATE key_terms SET value = $1, is_edited = true, original_ai_value = COALESCE(original_ai_value, value_before_update) WHERE id = $2 AND user_id = auth.uid()`
- `INSERT INTO term_corrections (key_term_id, contract_type, term_name, ai_value, corrected_value)` — feeds the weekly drift check and the 12%-correction-rate alert (PRD §8)

**API routes:** `PATCH /api/key-terms/{id}` (engineering-doc.md §9).

**State management:** React Query mutation with optimistic update on the term row; rollback on failure with a toast error. Must complete ≤2s per PRD constraint — no artificial delay in UI feedback.

**Component spec:** Inline edit affordance inside `KeyTermRow.tsx` (click-to-edit pattern, not a modal) — pencil icon on hover, `Enter` to save / `Esc` to cancel, `Badge` "Edited" appended once saved.

**Design notes:** Edit-mode input matches standard form input spec (44px, `#112E81` focus border). "Edited" badge uses `Warning`/neutral styling (not error) — it's informational, not a flag of a problem.

**Edge cases:**
- Empty value submitted → block save, inline validation ("Value cannot be empty")
- Concurrent edit conflict (unlikely at MVP, single-user-per-contract) — last write wins, no locking needed
- Editing a term that was already edited before → `original_ai_value` is NOT overwritten a second time (preserves true AI baseline for correction-rate accuracy)

---

## Feature: Contract Chat (US-007, US-012, FR-08, FR-09)

**User flow:** Results page → "Chat with Contract" (floating button or tab) → user types a question → response streams in, grounded in the document, with a `[Page X]` citation that scrolls the active viewer to that page → conversation persists and reloads on revisit.

**DB schema touched:** `chat_sessions` (create-once per contract), `chat_messages` (insert per turn).

**DB tasks:**
- On first message for a contract: `INSERT INTO chat_sessions (contract_id, user_id)` if none exists
- Fetch up to 200 prior `chat_messages` ascending for context (conversation memory, PRD Assumption #14)
- `INSERT INTO chat_messages (session_id, user_id, role='user', content)` then, after the model responds, `INSERT ... role='assistant', content`

**API routes:** `POST /api/contracts/{id}/chat` (send message, get response), `GET /api/contracts/{id}/chat` (load history on page mount) — both in engineering-doc.md §9.

**State management:** React Query for initial history load (`useChatHistory`); local state appends the in-flight user message + streaming assistant response optimistically, reconciled once the mutation resolves.

**Component spec:**
- `ChatPanel.tsx` — message list + input box, floating-button or sidebar-tab trigger from the results page
- `ChatMessage.tsx` — right-aligned user bubble (`#112E81` bg, white text), left-aligned assistant bubble (`#F1F5F9` bg, `#0F172A` text per `skills/design-system/SKILL.md`), citation rendered as a clickable page link that sets `targetPage` on the viewer

**Design notes:** Chat container `#FFFFFF` background, `#E2E8F0` border. "Based on the document…" prefix rendered as part of assistant message styling (small, muted-text lead-in), not user-editable.

**Edge cases:**
- Question about something absent from the document → expected valid response: "I cannot find this in the document." — covered by the automated hallucination regression test (engineering-doc.md §13)
- OpenAI timeout/failure → inline error bubble with retry action on that specific message, not a full-page error
- Message > 2,000 chars → block client-side with character counter
- Rate limit hit (Stage 7 rate limiter) → `429`, user-facing "You're sending messages too quickly — please wait a moment"
- User reopens a contract after 90-day PDF deletion but `contract_text` still exists → chat continues to work (text is the source of truth per PRD architecture note), only the PDF viewer is affected

---

## Feature: Dashboard & History (US-008, FR-10)

**User flow:** `/dashboard` shows a summary card (total contracts, breakdown by NDA/MSA, last 5 reviewed) and a sortable full history table; "Review a Contract" CTA prominent; empty state for first-time users.

**DB schema touched:** Read-only — `contracts`.

**DB tasks:** Direct Supabase client reads (no API route, per engineering-doc.md §9 note) — `SELECT count(*), count(*) FILTER (WHERE contract_type='NDA'), ... FROM contracts WHERE user_id = auth.uid()`; paginated/sortable list query ordered by `created_at`, `file_name`, or `contract_type` per user selection.

**API routes:** None — direct Supabase client SDK calls, RLS-scoped.

**State management:** React Query (`useDashboardSummary`, `useContractHistory`) with sort state (`useState`) driving the query's `order` clause.

**Component spec:**
- `SummaryCard.tsx` — total count, NDA/MSA breakdown, last-5 mini list
- `ContractHistoryTable.tsx` — sortable columns (name, type, date, status), row click → `/contracts/{id}/results`

**Design notes:** Table follows the same row-hover/selected conventions as the key term table (`#F8FAFC` hover). Status badges use Contract Status colors: Completed `#16A34A`, Processing `#F59E0B`, Failed `#DC2626`, Draft `#64748B`.

**Edge cases:**
- Zero contracts → empty state: "No contracts reviewed yet — upload your first contract to begin"
- Contract stuck in `status='processing'` beyond a reasonable timeout (e.g. >2 min) → dashboard shows it as "Processing" still; a stale-processing sweep is a Phase-2 concern, not MVP-blocking
- Contract in `status='error'` → shown with a "Failed" badge and a retry affordance linking back into the flow

---

## Feature: Feedback Submission (US-010, FR-12) — P2

**User flow:** On the results page, thumbs up/down widget with optional comment; submits independently of other actions.

**DB schema touched:** `user_feedback` (insert).

**DB tasks:** `INSERT INTO user_feedback (user_id, contract_id, rating, comment, created_at)`.

**API routes:** `POST /api/feedback` (engineering-doc.md §9).

**State management:** Simple local form state; React Query mutation; toast confirmation on success, no persistent UI state change needed beyond disabling re-submission for the same contract in the same session (not enforced server-side at MVP — P2 scope).

**Component spec:** `FeedbackWidget.tsx` — thumbs up/down icon buttons (Lucide React, 18px, stroke 1.5), optional expandable comment textarea.

**Design notes:** Uses Ghost button styling for the unselected state, filled Secondary color once a rating is selected.

**Edge cases:**
- Duplicate submission for the same contract → allowed at MVP (no upsert constraint); can be tightened post-launch if data quality requires it
- Comment > reasonable length (e.g. 1,000 chars) → client-side cap, no hard server validation needed at P2 priority

---

## Cross-Feature Notes

- **Disclaimer:** `Disclaimer.tsx` ("This is an AI-assisted review tool, not legal advice...") is not feature-specific — it's rendered once on every results page per PRD §9/§11 (Harmless pillar) and should be built alongside Results Display but treated as a standalone shared component.
- **`ai_usage_log`:** referenced in engineering-doc.md §8 for cost monitoring — not a user-facing feature, but its schema should be added in `database.sql` (project root) during Stage 2 (`{ id, contract_id, endpoint, prompt_tokens, completion_tokens, cost_usd, created_at }`).
- **Rate limiting, prompt-injection protection, and audit logging** are explicitly owned by Stage 7 (`/security-foundation`) and intentionally not spec'd in detail here — this document only notes where hooks are needed (e.g. `/process` and `/chat` routes).
