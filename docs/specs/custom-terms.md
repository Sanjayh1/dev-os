# Spec: Custom Key Term Addition

**Source:** engineering-doc.md §4 Flow 3 step 2, §9; implementation-specs.md "Custom Key Term Addition"
**Code paths:** `app/api/contracts/[id]/custom-terms/route.ts`, `app/contracts/new/components/CustomTermInput.tsx`

---

## User Flow

On `/contracts/new`, after upload succeeds, user clicks "+ Add Key Term", types a term name (e.g. "Non-compete radius"). It appears in `KeyTermPreviewList` with a "Custom" badge. Up to 5 allowed. Terms are batched and sent to the server when "Process Contract" is clicked (see rationale below).

---

## DB Schema Touched

`custom_key_terms` (insert). Extraction results for these carry `is_custom = true` in `key_terms` (see `key-term-extraction.md`).

---

## DB Tasks

```sql
insert into custom_key_terms (contract_id, user_id, term_name, is_manual)
values ($1, $2, $3, true);
```

One row per custom term. Capped at 5 per `contract_id` — enforced both in the API route and by the `trg_enforce_max_custom_terms` DB trigger (`database.sql`, project root) as defense-in-depth.

---

## API Route: `POST /api/contracts/{id}/custom-terms`

**Auth:** required, contract must belong to caller

**Request:** `{ "terms": string[] }` — max 5 items, each ≤100 chars

**Response `200`:**
```json
{ "custom_terms": [{ "id": "uuid", "term_name": "Non-compete radius" }] }
```

**Errors:** `400 max_custom_terms_exceeded`, `404 contract_not_found`

**Design decision — batch on process, not incremental:** call this route once, immediately before `/api/contracts/{id}/process` is invoked, sending the full draft list. This avoids partial `custom_key_terms` state if the user abandons the flow mid-way. Do not call this route on every keystroke or per-term-add.

---

## State Management

Local `useState` array of draft term strings on `/contracts/new`. Client-side validation before the batch call:
- max 5 terms
- non-empty
- ≤100 chars each
- no duplicates (case-insensitive)

---

## Component Spec

**`CustomTermInput.tsx`** — text input + "Add" button. Disables the "Add" button once 5 terms are reached. Each entry is removable before processing. Renders inline in `KeyTermPreviewList.tsx` with a `Badge` variant `"Custom"`.

---

## Design Notes

"Custom" badge uses Secondary color `#4647AE` to visually distinguish custom terms from standard terms in both the preview list and the results panel.

---

## Edge Cases

| Case | Behavior |
|---|---|
| 6th term attempted | Input/Add button disabled, tooltip: "Maximum 5 custom terms" |
| Duplicate term name (case-insensitive) | Inline validation error, never sent to server |
| Empty submission | "Process Contract" proceeds with zero custom terms — not required |
| Custom term not found in contract | Model returns low/zero confidence + empty value; still displayed with warning, never omitted |
