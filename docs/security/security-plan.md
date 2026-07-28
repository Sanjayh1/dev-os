# Security Plan

Generated per `skills/security-foundation/SKILL.md`, applied retroactively to an
already-built, already-tested application (Stage 7 in this project's actual
sequencing, run before Stage 6 deploy at the user's request — the skill's own
template assumes it runs before Stage 3 feature work, which didn't apply here).

---

## 1. Issues found and fixed

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | Login/signup/logout ran entirely client-side (`supabase.auth.*` called directly from the browser) — no server-side code path existed to rate limit or audit auth attempts | High | Moved to `app/api/auth/{login,signup,logout}/route.ts`; pages now `fetch()` these instead of calling the Supabase client directly |
| 2 | No rate limiting anywhere — upload, process, chat, and auth were all uncapped | High | `lib/security/rateLimiter.ts` + `rate_limit_events` table (`supabase/rls-policies.sql`), wired into all four surfaces |
| 3 | No prompt-injection defense on chat input — a user message like "ignore previous instructions" went straight to the model | Medium | `lib/security/promptInjectionGuard.ts`, checked before every chat call; `400 prompt_injection` short-circuits without calling OpenAI |
| 4 | Contract text (third-party authored) had no explicit "this is data, not instructions" guard in either prompt that embeds it | Medium | Added an explicit untrusted-data line to both `lib/openai/prompts/extraction.ts` and `lib/openai/prompts/chat.ts` (only when contract text is actually included) |
| 5 | Chat had no gate on contract processing status — a contract stuck in `processing`/`error` could still be chatted about | Medium | `POST /api/contracts/{id}/chat` now 404s unless `status === 'completed'` |
| 6 | File upload only checked MIME type and size — no extension blocklist, so a renamed executable with a spoofed MIME type had one fewer check standing in its way | Medium | `lib/security/inputValidator.ts`'s `validateFileUpload()` checks extension blocklist → allowlist/MIME → size, in that order |
| 7 | No authenticated-visitor redirect away from `/login`/`/signup` | Low | `middleware.ts` now redirects a session-holding visitor on those routes to `/dashboard` |
| 8 | Auth boilerplate (`getUser()` + manual 401) was duplicated verbatim across 9 routes, inviting a copy-paste gap | Low | `lib/security/authGuard.ts`'s `requireAuth()` |
| 9 | Ownership-check boilerplate (`select ... eq(id) ... single()` + 404) was duplicated across contract/session lookups | Low | `lib/security/chatSecurity.ts`'s `verifyContractOwnership()` / `verifySessionOwnership()` |
| 10 | Request bodies were validated with ad hoc manual checks, inconsistent in strictness across routes (e.g. feedback's `contract_id` was only checked to be *a string*, not a UUID) | Low | `lib/security/inputValidator.ts` — Zod schemas for every route; wired inline where it doesn't change documented behavior (see §3) |
| 11 | Chat history retrieval used `ORDER BY created_at ASC LIMIT N`, which returns the *oldest* N messages once a conversation exceeds the cap, not the most recent — found and fixed as part of the Conversation Memory Layer work, re-verified here | Medium | Already fixed in `app/api/contracts/[id]/chat/route.ts` (DESC + reverse) prior to this pass; confirmed still correct |
| 12 | `pdf-parse` was fundamentally broken under Next.js's server bundling (found during Stage 5 E2E testing, fixed then) — re-audited here for completeness, not a new finding | — | Already replaced with direct `pdfjs-dist` usage; no action needed this pass |

Nothing found in this pass involved data already exposed or exploited — these are all closed gaps, not incident remediations.

---

## 2. Rate limits (as implemented)

| Action | Window | Max | Keyed by |
|---|---|---|---|
| Authentication (login/signup) | 1 minute | 10 | attempted email (`identifier`) — see §3 for why not `user_id` |
| Chat | 1 minute | 30 | `user_id` |
| Contract processing | 1 hour | 5 | `user_id` |
| Contract upload | 24 hours | 20 | `user_id` |

All checks/writes go through `createAdminClient()` (service role) — a user can't clear or pad their own count via RLS-scoped access, because there is no user-facing grant on `rate_limit_events` at all.

---

## 3. Deliberate deviations from the skill template

The skill is a generic template; this is a specific, already-built, already-spec'd
product. Three places where following the template literally would have
contradicted the product's own documented behavior or made a control
unenforceable — kept the product's real behavior, noted here instead of
silently overriding it:

1. **`rate_limit_events.user_id` is nullable, plus a new `identifier` column.** The skill's schema assumes every rate-limited action has an authenticated user. Auth itself doesn't: a wrong-password login or a signup for an email nobody has used has no `user_id` to key by, and that's exactly the case this limit exists to slow down. Without a non-user-id key, "10/min on Authentication" would be unenforceable for the attacks it's meant to stop.

2. **Token/usage limits kept the product's real values, not the skill's generic defaults** (`lib/security/tokenLimiter.ts`):
   - `MAX_PAGE_COUNT = 20`, not the skill's 200 — this product's MVP scope is explicitly "up to ~20 pages" (`docs/specs/upload-extraction.md`).
   - `MAX_MESSAGE_LENGTH = 2000`, not the skill's 5000 — `chat_messages.content` has `CHECK (char_length(content) <= 2000)` in the database; a higher application-level limit would just start failing inserts.
   - `MAX_CHAT_HISTORY` defaults to 20, not the skill's suggested 100 — this product's Conversation Memory Layer already scopes `contract`/`both` questions to a fixed 10-turn window; a 100-turn ceiling for `history` would dwarf that for no reason. Still env-configurable per the skill's ask.
   - File uploads are PDF-only, not PDF+DOCX as the skill template lists — the extraction pipeline (`lib/pdf/extractText.ts`, `pdfjs-dist`) only reads PDF. Accepting `.docx` would pass validation and then fail unreadably downstream; documented as a known non-goal rather than silently promised.

3. **Existing routes kept their own already-documented, already-tested error codes/statuses instead of a blanket `422 VALIDATION_ERROR`.** `custom-terms`, `key-terms/[id]`, `feedback`, `chat`, and `upload` each have a specific error taxonomy already written into `docs/specs/*.md` and covered by the existing test suite (`max_custom_terms_exceeded`, `invalid_message`, `too_many_pages`, etc.). Every one of those routes is now backed by a Zod schema in `lib/security/inputValidator.ts` as the canonical, unit-tested contract — but the routes still *report* failures the way their specs already promise, rather than switching to a generic 422 that would break every consumer and test relying on the documented codes. The two brand-new routes with no prior contract (`/api/auth/login`, `/api/auth/signup`) do use the skill's literal `422 VALIDATION_ERROR` convention, since there's nothing to preserve there.

---

## 4. Files created

**`lib/security/`**
- `authGuard.ts` — `requireAuth()`
- `rateLimiter.ts` — `checkRateLimit()`, `rateLimitedResponse()`
- `promptInjectionGuard.ts` — `sanitizeForLLM()`
- `tokenLimiter.ts` — consolidated size/page/length/history constants
- `chatSecurity.ts` — `verifyContractOwnership()`, `verifySessionOwnership()`
- `inputValidator.ts` — Zod schemas for every route + `validateFileUpload()`

**`lib/supabase/admin.ts`** — `createAdminClient()` (service role, rate limiter only)

**`app/api/auth/`** — `login/route.ts`, `signup/route.ts`, `logout/route.ts` (new)

**`supabase/rls-policies.sql`** — `rate_limit_events` table + idempotent RLS re-affirmation for all existing tables

**Tests** — `lib/security/*.test.ts` (6 files), `app/api/auth/*/route.test.ts` (3 files)

## 5. Files modified

- `middleware.ts` — authenticated-visitor redirect away from `/login`/`/signup`
- `app/(auth)/login/page.tsx`, `signup/page.tsx` — call the new API routes instead of the Supabase client directly
- `app/dashboard/page.tsx` — added the first logout affordance in the app (there was none before)
- `app/api/contracts/upload/route.ts` — `requireAuth`, rate limit, `validateFileUpload`
- `app/api/contracts/[id]/process/route.ts` — `requireAuth`, rate limit
- `app/api/contracts/[id]/custom-terms/route.ts` — `requireAuth`, `verifyContractOwnership`
- `app/api/contracts/[id]/route.ts` — `requireAuth`
- `app/api/contracts/[id]/chat/route.ts` — `requireAuth`, rate limit, `sanitizeForLLM`, completed-status gate
- `app/api/key-terms/[id]/route.ts` — `requireAuth`, Zod-backed body validation
- `app/api/feedback/route.ts` — `requireAuth`, `verifyContractOwnership`, Zod-backed body validation
- `lib/openai/prompts/extraction.ts`, `chat.ts` — untrusted-contract-text guard line
- `lib/testing/fakeSupabaseServerClient.ts`, `fakeSupabaseBrowserClient.ts` — E2E fake now backs `signInWithPassword`/`signUp`/`signOut` server-side (matching the real auth routes), removed the now-redundant test-only `/api/test/auth/*` routes
- `.env.example` — added `MAX_CHAT_HISTORY`

---

## 6. SQL to run in Supabase

Paste `supabase/rls-policies.sql` into the SQL Editor (idempotent, safe to re-run):

```sql
create table if not exists rate_limit_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade,
  identifier text,
  action     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_user_lookup
  on rate_limit_events (user_id, action, created_at desc);
create index if not exists idx_rate_limit_events_identifier_lookup
  on rate_limit_events (identifier, action, created_at desc);

alter table rate_limit_events enable row level security;
grant select, insert on rate_limit_events to service_role;

alter table contracts enable row level security;
alter table key_terms enable row level security;
alter table custom_key_terms enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table user_feedback enable row level security;
alter table ai_usage_log enable row level security;
alter table term_corrections enable row level security;
```

Also still outstanding from Stage 5 (unrelated to this pass, in case not yet done):
```sql
alter table chat_messages add column context_type text check (context_type in ('contract', 'history', 'both'));
```

## 7. Environment variables to add

```
MAX_CHAT_HISTORY=20
```
(Added to `.env.example`; copy into `.env.local` and your deployment platform's env config. Optional — defaults to 20 if unset.)

## 8. Manual verification still required (Supabase dashboard, not code)

- Email verification enforcement
- Password reset flow (already wired client-side via `resetPasswordForEmail`; confirm the email template/redirect URL in the dashboard)
- Session management / refresh token rotation settings

These are dashboard configuration, not something this pass can set via code.

## 9. Test coverage added

- 140 Vitest tests total (53 new/updated across security modules and route wiring)
- 16 Playwright E2E tests, all passing against the reworked server-side auth flow
