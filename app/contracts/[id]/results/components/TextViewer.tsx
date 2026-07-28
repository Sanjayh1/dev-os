'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Spec: docs/specs/results-display.md
// Parses "[PAGE N]" markers into labelled page sections. Zoom-independent —
// font-size controls instead of PDF zoom. Same targetPage contract as PdfViewer:
// scroll to and highlight the matching section.

interface TextViewerProps {
  text: string
  targetPage: number | null
}

interface PageSection {
  pageNumber: number
  content: string
}

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 22
const FONT_STEP = 2

function parsePages(text: string): PageSection[] {
  const parts = text.split(/\[PAGE (\d+)\]/)
  const sections: PageSection[] = []
  // parts[0] is any preamble before the first marker; alternates [num, content] after.
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ pageNumber: Number(parts[i]), content: parts[i + 1] ?? '' })
  }
  return sections
}

export function TextViewer({ text, targetPage }: TextViewerProps) {
  const sections = useMemo(() => parsePages(text), [text])
  const [fontSize, setFontSize] = useState(16)
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null)
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (targetPage == null) return
    const maxPage = sections[sections.length - 1]?.pageNumber ?? targetPage
    const clamped = Math.min(targetPage, maxPage)
    sectionRefs.current.get(clamped)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightedPage(clamped)
    const timeout = setTimeout(() => setHighlightedPage(null), 2000)
    return () => clearTimeout(timeout)
  }, [targetPage, sections])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-sm border-b border-border bg-primary px-md py-sm">
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - FONT_STEP))}
          className="rounded-input px-sm py-xs text-body font-semibold text-white hover:bg-primary-hover"
          aria-label="Decrease text size"
        >
          A−
        </button>
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + FONT_STEP))}
          className="rounded-input px-sm py-xs text-body font-semibold text-white hover:bg-primary-hover"
          aria-label="Increase text size"
        >
          A+
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-surface-elevated p-md" style={{ fontSize }}>
        {sections.map((section) => (
          <div
            key={section.pageNumber}
            ref={(el) => {
              if (el) sectionRefs.current.set(section.pageNumber, el)
            }}
            className={`mb-md rounded-input p-md transition duration-150 ease-out ${
              highlightedPage === section.pageNumber ? 'bg-accent-light' : ''
            }`}
          >
            <p className="mb-xs text-small font-semibold text-text-muted">Page {section.pageNumber}</p>
            <p className="whitespace-pre-wrap text-text-primary">{section.content.trim()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
