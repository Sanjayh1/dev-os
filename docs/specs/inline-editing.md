# Spec: Inline Key Term Editing

**Source:** engineering-doc.md §4 Flow 3 step 5, §9; implementation-specs.md "Inline Key Term Editing"
**Code paths:** `app/api/key-terms/[id]/route.ts`, `app/contracts/[id]/results/components/KeyTermRow.tsx`

---

## User Flow

User clicks a term's value in `KeyTermRow.tsx` → field becomes editable → types a correction → saves (`Enter`) or cancels (`Esc`) → row shows an "Edited" badge; the original AI value is preserved for the feedback loop.

---

## DB Schema Touched

`key_terms` (update), `term_corrections` (insert).

---

## DB Tasks

```sql
update key_terms
set value = $1,
    is_edited = true,
    original_ai_value = coalesce(original_ai_value, value)  -- only ever set once
where id = $2 and user_id = auth.uid();

insert into term_corrections (key_term_id, contract_type, term_name, ai_value, corrected_value)
values ($1, $2, $3, $4, $5);
```

`original_ai_value` must be captured from the row's current `value` **before** the update runs (i.e. read-then-write, not derivable from `coalesce` alone in application code — the SQL above relies on `coalesce` reading the pre-update row value within the same statement).

---

## API Route: `PATCH /api/key-terms/{id}`

**Auth:** required, ownership check (via joined `contracts.user_id`)

**Request:** `{ "value": string }`

**Response `200`:**
```json
{ "id": "uuid", "value": "corrected value", "is_edited": true, "original_ai_value": "original AI value" }
```

**Side effect:** inserts a row into `term_corrections` — feeds the weekly drift check and the 12%-correction-rate alert (engineering-doc.md §8).

**Errors:** `404 term_not_found`, `400 invalid_value` (empty string)

---

## State Management

React Query mutation with optimistic update on the term row; rollback + toast error on failure. Must complete ≤2s (PRD constraint) — no artificial UI delay.

---

## Component Spec

Inline edit affordance inside `KeyTermRow.tsx` — click-to-edit pattern (not a modal). Pencil icon appears on hover. `Enter` saves, `Esc` cancels. `Badge` "Edited" appended once saved.

---

## Design Notes

Edit-mode input matches the standard form input spec: 44px height, `#112E81` focus border. "Edited" badge uses neutral/informational styling (not error/warning) — it signals a fact, not a problem.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Empty value submitted | Block save, inline validation: "Value cannot be empty" |
| Concurrent edit conflict | Not a concern at MVP (single-user-per-contract) — last write wins, no locking |
| Editing an already-edited term again | `original_ai_value` is NOT overwritten a second time — preserves the true AI baseline for correction-rate accuracy |
