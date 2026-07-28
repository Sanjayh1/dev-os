# Spec: Results Display — PDF Viewer + Text Viewer Fallback

**Source:** engineering-doc.md §4 Flow 3 step 4, §5, §9; implementation-specs.md "Results Display"
**Code paths:** `app/contracts/[id]/results/page.tsx`, `app/contracts/[id]/results/components/*`

---

## User Flow

Results page loads a two-panel layout: left — `ContractViewerPanel` (PDF.js viewer if a valid signed URL exists, otherwise `TextViewer`); right — `KeyTermsPanel`. Clicking a term's page number scrolls/highlights the corresponding location in whichever viewer is active. Below `md` breakpoint, panels stack (viewer above key terms).

---

## DB Schema Touched

Read-only: `contracts` (`file_path`, `contract_text`, `page_count`), `key_terms`, `custom_key_terms`.

---

## DB Tasks

```sql
select * from contracts where id = $1 and user_id = auth.uid();
select * from key_terms where contract_id = $1 and user_id = auth.uid();
select * from custom_key_terms where contract_id = $1 and user_id = auth.uid();
```

If `file_path` is not null, generate a 1-hour signed URL via `supabase.storage.from('contracts').createSignedUrl(file_path, 3600)`. If `file_path` is null or signed-URL generation throws, `signed_url` is returned as `null` — this is a first-class path, not a degraded one; the frontend renders `TextViewer` with full parity.

Also updates `contracts.last_accessed_at = now()` on each results-page view (drives the 90-day retention job).

---

## API Route: `GET /api/contracts/{id}`

**Auth:** required, ownership check

**Response `200`:**
```json
{
  "contract": { "id": "uuid", "file_name": "...", "contract_type": "NDA", "page_count": 12, "status": "completed" },
  "key_terms": [ { "id": "uuid", "term_name": "...", "value": "...", "page_number": 4, "confidence_score": 92.5, "source_sentence": "...", "is_custom": false, "is_edited": false } ],
  "custom_terms": [ { "id": "uuid", "term_name": "..." } ],
  "signed_url": "https://... | null"
}
```

**Errors:** `404 contract_not_found`, `403 forbidden`

---

## State Management

- `activeViewer: 'pdf' | 'text'` — derived from `signed_url` presence. A manual "Download PDF" link is always shown regardless of which viewer is active (PDF.js-compatibility risk mitigation).
- `targetPage: number | null` — lifted to the results page (`useState`), passed as a prop to whichever viewer is mounted. Both viewers must react identically: smooth scroll + highlight on change.

---

## Component Spec

- **`ContractViewerPanel.tsx`** — switch component: renders `PdfViewer` if `signed_url` is present and hasn't errored, else `TextViewer`.
- **`PdfViewer.tsx`** — PDF.js, lazy page loading (mobile memory control), zoom controls, accepts `targetPage: number | null` prop, highlights term-associated spans. On render error, calls an `onError` callback that flips `activeViewer` to `'text'`.
- **`TextViewer.tsx`** — parses `[PAGE N]` markers from `contract_text` into labelled page sections via `/\[PAGE (\d+)\]/`, accepts the same `targetPage` prop, scrolls to and highlights the matching section. Zoom-independent readable layout (font-size controls instead of PDF zoom).
- **`KeyTermsPanel.tsx`** — table: Key Term · Value · Page Number · Confidence Score · Status.
- **`KeyTermRow.tsx`** — term name, value, page number (click → sets `targetPage`), confidence badge (see `key-term-extraction.md` for tier colors), expandable "Why?" showing `source_sentence`, inline-edit affordance (see `inline-editing.md`).
- **`Disclaimer.tsx`** — "This is an AI-assisted review tool, not legal advice…" — rendered once at the top of every results page. Shared component, not feature-specific to this spec, but built alongside it.

---

## Design Notes

Contract viewer toolbar: `#112E81` background (Primary). Selected-text highlight: `#AACCD6` (Accent). Key term table: row hover `#F8FAFC` (Background Subtle), selected row `#D8E8ED` (Accent Light). Below `md` breakpoint: viewer panel stacks above key terms panel.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Signed URL expired mid-session (>1hr) | On viewer error, re-request a fresh signed URL rather than failing silently |
| Storage bucket/policy misconfigured | `signed_url` generation throws server-side → caught, `signed_url: null` returned, `TextViewer` used, non-blocking banner: "PDF preview unavailable — showing extracted text instead" |
| PDF.js render failure (unusual fonts/layout) | Catch client-side render error, offer "Download PDF" link, auto-switch to `TextViewer` |
| Term's `page_number` exceeds `page_count` (malformed model output) | Clamp to last page — do not crash the viewer |
