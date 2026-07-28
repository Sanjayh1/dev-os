# Spec: Feedback Submission (P2)

**Source:** engineering-doc.md §4 Flow 6, §9; implementation-specs.md "Feedback Submission"
**Code paths:** `app/api/feedback/route.ts`, `app/contracts/[id]/results/components/FeedbackWidget.tsx`

---

## User Flow

On the results page, a thumbs up/down widget with an optional comment submits independently of other actions — no page navigation, inline confirmation toast.

---

## DB Schema Touched

`user_feedback` (insert).

---

## DB Tasks

```sql
insert into user_feedback (user_id, contract_id, rating, comment)
values ($1, $2, $3, $4);
```

---

## API Route: `POST /api/feedback`

**Auth:** required

**Request:** `{ "contract_id": string, "rating": "up" | "down", "comment"?: string }`

**Response `201`:** `{ "id": "uuid" }`

**Errors:** `404 contract_not_found`

---

## State Management

Simple local form state; React Query mutation; toast confirmation on success. No persistent UI state change beyond disabling re-submission for the same contract within the same client session (not server-enforced at MVP — P2 scope).

---

## Component Spec

**`FeedbackWidget.tsx`** — thumbs up/down icon buttons (Lucide React, 18px, stroke 1.5), optional expandable comment textarea.

---

## Design Notes

Ghost button styling for the unselected state; filled Secondary color (`#4647AE`) once a rating is selected.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Duplicate submission for the same contract | Allowed at MVP (no upsert constraint) — can be tightened post-launch if data quality requires it |
| Comment > 1,000 chars | Client-side cap; no hard server validation needed at P2 priority |
