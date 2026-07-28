'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Spec: docs/specs/results-display.md
// PDF.js viewer with lazy page rendering (mobile memory control), zoom
// controls, and a targetPage scroll/highlight contract shared with TextViewer.
// Note: extraction only stores page_number, not per-span coordinates, so
// "highlighting the term-associated span" is approximated as a page-level
// highlight rather than a text-span highlight.
//
// The worker is served as a static file (public/pdf.worker.min.mjs, kept in
// sync via scripts/copy-pdf-worker.js) rather than bundled via `new URL(...)`
// — webpack's Terser minifier can't process the worker's ESM output when
// it's pulled into the JS compilation graph that way.

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PdfViewerProps {
  url: string
  targetPage: number | null
  onError: () => void
}

const MIN_SCALE = 0.75
const MAX_SCALE = 2.5
const SCALE_STEP = 0.25

export function PdfViewer({ url, targetPage, onError }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    let cancelled = false
    pdfjsLib
      .getDocument(url)
      .promise.then((loaded) => {
        if (cancelled) return
        setDoc(loaded)
        setNumPages(loaded.numPages)
      })
      .catch(() => {
        if (!cancelled) onError()
      })
    return () => {
      cancelled = true
    }
  }, [url, onError])

  useEffect(() => {
    if (!doc || numPages === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const pageNumber = Number(entry.target.getAttribute('data-page'))
          setRenderedPages((prev) => (prev.has(pageNumber) ? prev : new Set(prev).add(pageNumber)))
        })
      },
      { rootMargin: '200px' }
    )
    pageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [doc, numPages])

  useEffect(() => {
    if (!doc) return

    let cancelled = false

    async function renderPending() {
      await Promise.all(
        Array.from(renderedPages).map(async (pageNumber) => {
          const canvas = canvasRefs.current.get(pageNumber)
          if (!canvas) return
          try {
            const page = await doc!.getPage(pageNumber)
            const viewport = page.getViewport({ scale })
            canvas.width = viewport.width
            canvas.height = viewport.height
            const context = canvas.getContext('2d')
            if (!context || cancelled) return
            await page.render({ canvasContext: context, viewport }).promise
          } catch {
            if (!cancelled) onError()
          }
        })
      )
    }

    renderPending()
    return () => {
      cancelled = true
    }
  }, [renderedPages, scale, doc, onError])

  useEffect(() => {
    if (targetPage == null || numPages === 0) return
    const clamped = Math.min(targetPage, numPages)
    pageRefs.current.get(clamped)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedPage(clamped)
    const timeout = setTimeout(() => setHighlightedPage(null), 2000)
    return () => clearTimeout(timeout)
  }, [targetPage, numPages])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-sm border-b border-border bg-primary px-md py-sm">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, Number((s - SCALE_STEP).toFixed(2))))}
          className="rounded-input px-sm py-xs text-body font-semibold text-white hover:bg-primary-hover"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="text-small text-white">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(MAX_SCALE, Number((s + SCALE_STEP).toFixed(2))))}
          className="rounded-input px-sm py-xs text-body font-semibold text-white hover:bg-primary-hover"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-surface p-md">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
          <div
            key={pageNumber}
            data-page={pageNumber}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNumber, el)
            }}
            className={`mx-auto mb-md flex justify-center rounded-input transition duration-150 ease-out ${
              highlightedPage === pageNumber ? 'ring-4 ring-accent' : ''
            }`}
          >
            <canvas ref={(el) => {
              if (el) canvasRefs.current.set(pageNumber, el)
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}
