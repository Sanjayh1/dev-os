// Spec: docs/specs/upload-extraction.md
// Uses pdfjs-dist directly (the same modern, actively-maintained library
// PdfViewer.tsx already uses client-side) rather than the `pdf-parse`
// wrapper. pdf-parse pins an ancient (2017-era) bundled pdfjs and dynamically
// requires it in a way that breaks under Next.js's webpack server bundling —
// `PDFJS.getDocument()` threw "bad XRef entry" on a verifiably well-formed
// PDF whose bytes arrived uncorrupted, while the identical buffer parsed
// fine outside the bundle. Caught by E2E testing a real upload end-to-end;
// the Vitest integration tests mock this module, so they never hit it.
import path from 'path'
import { pathToFileURL } from 'url'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface ExtractResult {
  text: string
  pageCount: number
  wordCount: number
}

// process.cwd()-relative, not require.resolve() — webpack's production
// bundling rewrites require.resolve() calls to a numeric internal module id
// instead of leaving the real filesystem path, which broke this exactly the
// way the workerSrc comment below describes.
const STANDARD_FONT_DATA_URL =
  path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep

// With no workerSrc set, pdfjs falls back to a "fake worker" it locates via a
// dynamic import relative to its own bundled location — which doesn't
// resolve inside Next's webpack server bundle ("Cannot find module
// '.next/server/vendor-chunks/pdf.worker.mjs'"). Pointing it at the worker
// file directly via an absolute file:// URL (the same file the browser's
// PdfViewer uses, copied to public/ by scripts/copy-pdf-worker.js) sidesteps
// that resolution entirely — plain path/url math, nothing webpack analyzes.
GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(process.cwd(), 'public', 'pdf.worker.min.mjs')
).href

export async function extractText(buffer: Buffer): Promise<ExtractResult> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise

  let text = ''
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    text += `[PAGE ${pageNumber}]\n${pageText}\n\n`
  }

  return {
    text,
    pageCount: doc.numPages,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  }
}
