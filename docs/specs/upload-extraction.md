# Spec: PDF Upload + Text Extraction

**Source:** engineering-doc.md §4 Flow 3 steps 1–2, §9; implementation-specs.md "PDF Upload + Text Extraction"
**Code paths:** `app/contracts/new/page.tsx`, `app/contracts/new/components/*`, `app/api/contracts/upload/route.ts`, `lib/pdf/extractText.ts`

---

## User Flow

1. User navigates to `/contracts/new`.
2. Selects contract type (NDA or MSA) via `ContractTypeSelector`.
3. Drags/drops or picks a PDF via `UploadDropzone`.
4. Client validates file type (`application/pdf`) and size (≤10MB) before submitting.
5. Submits → server extracts text, validates limits, creates the `contracts` row.
6. Frontend shows the static standard-term preview list for the selected type while the user optionally adds custom terms (see `custom-terms.md`).

---

## DB Schema Touched

`contracts` (insert). See `database.sql` (project root) for full column definitions.

---

## DB Tasks

```sql
insert into contracts (
  user_id, contract_type, file_name, file_path,
  contract_text, page_count, token_count, status
) values ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
returning id;
```

- `file_path` is `null` if the Storage upload fails — this is non-blocking, the row is still created.
- No row is inserted at all if text extraction fails or a hard validation rejects the file (invalid type, too large, too many pages, token limit, scanned PDF).

---

## API Route: `POST /api/contracts/upload`

**Auth:** required (session validated server-side)

**Request:** `multipart/form-data`
- `file`: PDF, ≤10MB
- `contract_type`: `'NDA' | 'MSA'`

**Response `201`:**
```json
{
  "contract_id": "uuid",
  "page_count": 12,
  "token_count": 4210,
  "standard_terms_preview": ["Governing Law", "Term Length", "..."]
}
```

**Server-side steps (in order):**
1. Validate `file.type === 'application/pdf'` and `file.size <= 10 * 1024 * 1024`. Reject with `400 invalid_file_type` / `400 file_too_large` before touching Storage or parsing.
2. Generate `contract_id` (uuid), attempt upload to Supabase Storage at `contracts/{user_id}/{contract_id}/{filename}.pdf`. Catch any Storage error and continue — do not fail the request; `file_path` stays `null`.
3. Run `lib/pdf/extractText.ts` against the raw file buffer → text with `[PAGE N]` markers inserted at each page boundary, plus `page_count`.
4. If extracted word count < 100 → `400 scanned_pdf_unsupported`, no DB row written.
5. If `page_count > 20` → `400 too_many_pages`, no DB row written.
6. Compute `token_count` (tiktoken-compatible estimate). If `> 15000` → `400 token_limit_exceeded`, no DB row written.
7. Insert `contracts` row with `status = 'uploaded'`.
8. Return `contract_id`, `page_count`, `token_count`, and the static `standard_terms_preview` list for `contract_type` (see below).

**Errors:** `400 invalid_file_type`, `400 file_too_large`, `400 too_many_pages`, `400 scanned_pdf_unsupported`, `400 token_limit_exceeded`, `500 pdf_read_failed` (corrupted/unreadable PDF — caught `pdf-parse` exception).

---

## `lib/pdf/extractText.ts` Contract

```ts
interface ExtractResult {
  text: string        // full text with "[PAGE N]" markers inserted at each page boundary
  pageCount: number
  wordCount: number
}

function extractText(buffer: Buffer): Promise<ExtractResult>
```

Marker format: `[PAGE 1]`, `[PAGE 2]`, ... inserted immediately before each page's text content, so downstream consumers (extraction prompt, chat, `TextViewer`) can split on `/\[PAGE (\d+)\]/`.

---

## Standard Term Lists (per `contract_type`)

Used for `standard_terms_preview` and as the extraction target-term list (see `key-term-extraction.md`).

**NDA (10 terms):** Disclosing Party, Receiving Party, Effective Date, Term Length, Confidentiality Scope, Permitted Exceptions, Governing Law, Return/Destruction of Information Clause, Remedies for Breach, Termination Conditions

**MSA (12 terms):** Client Party, Service Provider Party, Effective Date, Term Length, Scope of Services, Payment Terms, Governing Law, Limitation of Liability, Indemnification Clause, Confidentiality Clause, Termination Conditions, Dispute Resolution Mechanism

---

## State Management

- Local `useState`: selected file, contract type, upload progress, validation errors.
- `useUploadContract` — React Query mutation wrapping the POST call. On success, navigates to the term-preview step carrying `contract_id`.

---

## Component Spec

- **`ContractTypeSelector.tsx`** — dropdown, `'NDA' | 'MSA'`.
- **`UploadDropzone.tsx`** — drag-and-drop + file picker; shows filename/size once selected; inline validation errors rendered immediately, before any network call.
- **`KeyTermPreviewList.tsx`** — renders the static standard-term list (above) for the chosen type while extraction/preview loads; rows show muted-text term names with no values until processing completes.

---

## Design Notes

Dropzone: card styling, `12px` radius, `#E2E8F0` border (Border Default). Drag-active state: `#AACCD6` accent border (Accent). Standard-term list rows: Body text style (14px), muted-text (`#64748B`) term names pre-processing.

---

## Edge Cases

| Case | Behavior |
|---|---|
| File > 10MB | Reject client-side before upload attempt; show exact file size |
| Non-PDF file | Reject client-side, no network call |
| > 20 pages | Reject server-side after parse (page count isn't knowable pre-parse for all PDFs) |
| Token count > 15,000 | `400 token_limit_exceeded`, message: "This contract is too long for MVP support (max ~20 pages)" |
| Storage upload fails, text extraction succeeds | Contract still created (`status='uploaded'`, `file_path=null`); results page falls back to `TextViewer` later — not blocked here |
| Corrupted/unreadable PDF | Catch `pdf-parse` exception, return `400` "We couldn't read this PDF — please check the file and try again," no partial `contracts` row persisted |
