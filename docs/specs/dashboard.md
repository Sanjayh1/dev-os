# Spec: Dashboard & History

**Source:** engineering-doc.md §4 Flow 5, §9; implementation-specs.md "Dashboard & History"
**Code paths:** `app/dashboard/page.tsx`, `app/dashboard/components/*`

---

## User Flow

`/dashboard` shows a summary card (total contracts, breakdown by NDA/MSA, last 5 reviewed) and a sortable full history table. "Review a Contract" CTA is prominent. First-time users see an empty state.

---

## DB Schema Touched

Read-only: `contracts`.

---

## DB Tasks

No API route — direct Supabase client SDK reads, RLS-scoped (per engineering-doc.md §9: only OpenAI-heavy operations go through the backend).

```sql
-- Summary counts
select
  count(*) as total,
  count(*) filter (where contract_type = 'NDA') as nda_count,
  count(*) filter (where contract_type = 'MSA') as msa_count
from contracts where user_id = auth.uid();

-- Last 5 reviewed
select id, file_name, contract_type, status, created_at
from contracts where user_id = auth.uid()
order by created_at desc limit 5;

-- Full sortable history (sort column driven by user selection: created_at | file_name | contract_type)
select id, file_name, contract_type, status, created_at
from contracts where user_id = auth.uid()
order by {sort_column} {asc|desc};
```

---

## API Routes

None. Frontend queries Supabase directly via the client SDK.

---

## State Management

- `useDashboardSummary` — React Query, fetches the summary counts + last-5 list.
- `useContractHistory` — React Query, fetches the sortable history table; query key includes sort state.
- `useState` for current sort column/direction, driving the query's `order` clause.

---

## Component Spec

- **`SummaryCard.tsx`** — total count, NDA/MSA breakdown, last-5 mini list.
- **`ContractHistoryTable.tsx`** — sortable columns (name, type, date, status); row click navigates to `/contracts/{id}/results`.

---

## Design Notes

Table follows the same row-hover/selected conventions as the key term table (`#F8FAFC` hover, per `results-display.md`). Status badges use Contract Status colors: Completed `#16A34A`, Processing `#F59E0B`, Failed `#DC2626`, Draft `#64748B`.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Zero contracts | Empty state: "No contracts reviewed yet — upload your first contract to begin" |
| Contract stuck in `status='processing'` beyond ~2 min | Still shown as "Processing" — a stale-processing sweep is a Phase-2 concern, not MVP-blocking |
| Contract in `status='error'` | Shown with a "Failed" badge and a retry affordance linking back into the flow |
