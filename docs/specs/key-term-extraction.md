# Spec: Key Term Extraction

**Source:** engineering-doc.md §4 Flow 3 step 3, §8, §9; implementation-specs.md "Key Term Extraction"
**Code paths:** `app/api/contracts/[id]/process/route.ts`, `lib/openai/client.ts`, `lib/openai/prompts/extraction.ts`, `lib/terms/confidence.ts`, `ProcessingProgress.tsx`

---

## User Flow

User clicks "Process Contract" → 3-step progress indicator (extracting ✓ already done → analysing with AI → compiling results) → redirected to `/contracts/{id}/results` on completion.

---

## DB Schema Touched

`contracts` (status update), `key_terms` (bulk insert).

---

## DB Tasks

1. `update contracts set status = 'processing' where id = $1 and user_id = auth.uid();`
2. On successful extraction, bulk insert:
   ```sql
   insert into key_terms (
     contract_id, user_id, term_name, value, page_number,
     confidence_score, source_sentence, is_custom
   ) values ...;
   ```
3. `update contracts set status = 'completed' where id = $1;` on success, or `status = 'error', error_message = $2` after retries/backoff exhausted.

---

## API Route: `POST /api/contracts/{id}/process`

**Auth:** required, ownership check (`contracts.user_id === session.user.id`)

**Request:** `{}` — uses stored `contract_text` + any persisted `custom_key_terms` rows for this contract.

**Response `200`:**
```json
{
  "status": "completed",
  "key_terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 92.5,
      "source_sentence": "This Agreement shall be governed by the laws of the State of Delaware.",
      "is_custom": false
    }
  ]
}
```

**Response `202`** (if processing is queued rather than synchronous): `{ "status": "processing" }` — frontend polls `GET /api/contracts/{id}` or subscribes via Supabase Realtime on `contracts.status`.

**Errors:** `422 contract_not_uploaded` (called before upload completed), `502 openai_extraction_failed` (after retries exhausted), `504 openai_timeout`.

**Server-side steps:**
1. Verify `contracts.status === 'uploaded'`; else `422 contract_not_uploaded`.
2. Set `status = 'processing'`.
3. Build the extraction prompt (`lib/openai/prompts/extraction.ts`) from `contract_text` + the standard term list for `contract_type` (see `upload-extraction.md`) + any `custom_key_terms` rows.
4. Call OpenAI (`lib/openai/client.ts`): model `gpt-4o`, `response_format: { type: 'json_object' }`, `temperature: 0.1`, `max_tokens: 2000`.
5. Parse the JSON response. On parse failure, send exactly one corrective retry: `"Your previous response was not valid JSON. Return only the JSON array, no explanation."` If that also fails to parse, treat as a hard failure (step 7).
6. On any OpenAI network/5xx failure: retry up to 3 attempts total with exponential backoff (e.g. 1s, 2s, 4s).
7. On exhausted retries or unparseable JSON: `status = 'error'`, `error_message` populated, return `502 openai_extraction_failed`.
8. On success: for each returned term, apply the confidence floor (`lib/terms/confidence.ts` — see below), bulk-insert into `key_terms`, set `status = 'completed'`.

---

## `lib/openai/prompts/extraction.ts` Contract

```ts
interface ExtractionPromptInput {
  contractText: string          // includes [PAGE N] markers
  contractType: 'NDA' | 'MSA'
  customTerms: string[]         // up to 5, from custom_key_terms
}

interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number
  confidence_score: number      // 0.0–100.0, model self-reported
  source_sentence: string
  is_custom: boolean
}

function buildExtractionPrompt(input: ExtractionPromptInput): { system: string; user: string }
```

System prompt includes 3 labelled NDA + 3 labelled MSA few-shot examples (per engineering-doc.md §8 prompt strategy) and instructs the model to return a JSON array matching `ExtractedTerm[]` under a single top-level key (required for `json_object` mode), e.g. `{ "terms": ExtractedTerm[] }`.

---

## `lib/terms/confidence.ts` Contract

```ts
type ConfidenceTier = 'high' | 'medium' | 'low' | 'critical'

function getConfidenceTier(score: number): ConfidenceTier
// 90-100 -> 'high' (#16A34A) | 70-89 -> 'medium' (#84CC16) | 50-69 -> 'low' (#F59E0B) | <50 -> 'critical' (#DC2626)

function enforceConfidenceFloor(term: ExtractedTerm): ExtractedTerm
// If term.source_sentence is empty/missing, force confidence_score to min(confidence_score, 49) —
// a term with no traceable source sentence is never displayed as reliable, regardless of model-reported score.
```

This is enforced server-side at insert time — the render layer trusts the stored `confidence_score`, it does not re-derive it.

---

## State Management

React Query mutation (`useProcessContract`) triggers `/process`. `ProcessingProgress.tsx` binds to `contracts.status` via polling or Supabase Realtime subscription — no client-side timers guessing progress duration.

---

## Component Spec

- **`ProcessingProgress.tsx`** — 3-step indicator: `uploaded` → step 1 done, `processing` → step 2 active, `completed` → step 3 done + redirect to `/contracts/{id}/results`. `error` status shows a failure state with a retry CTA (re-invokes `/process`, no re-upload).
- `KeyTermsPanel.tsx` / `KeyTermRow.tsx` render on the results page once terms exist — see `results-display.md`.

---

## Design Notes

Confidence colour-coding per `skills/design-system/SKILL.md`: 90–100% `#16A34A`, 70–89% `#84CC16`, 50–69% `#F59E0B`, <50% `#DC2626`. Low-confidence rows always render a non-dismissible warning icon + tooltip — never hidden.

---

## Edge Cases

| Case | Behavior |
|---|---|
| OpenAI timeout/5xx | 3-attempt retry with exponential backoff; on exhaustion, `status='error'`, "Try again in a few minutes" CTA re-triggers `/process` without re-upload |
| JSON parse failure | One corrective retry prompt before surfacing an error |
| Model returns fewer terms than expected | Store what's returned; missing terms simply don't render as rows — no fabricated placeholders |
| Confidence < 50% | ⚠️ flag + tooltip, term still shown (never hidden) |
| Term has no `source_sentence` | Force-capped confidence <50% regardless of model-reported score |
