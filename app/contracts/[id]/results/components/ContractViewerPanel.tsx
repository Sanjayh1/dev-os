'use client'

import { useEffect, useState } from 'react'
import { PdfViewer } from './PdfViewer'
import { TextViewer } from './TextViewer'

// Spec: docs/specs/results-display.md
// Switch component: PdfViewer if signed_url is present and hasn't errored,
// else TextViewer. "Download PDF" link is always shown when a signed URL
// exists, regardless of which viewer is active.

interface ContractViewerPanelProps {
  signedUrl: string | null
  contractText: string
  targetPage: number | null
  onRefreshSignedUrl: () => void
}

export function ContractViewerPanel({
  signedUrl,
  contractText,
  targetPage,
  onRefreshSignedUrl,
}: ContractViewerPanelProps) {
  const [pdfFailed, setPdfFailed] = useState(false)
  const [hasRetried, setHasRetried] = useState(false)

  useEffect(() => {
    // A fresh signed URL arrived (e.g. after a refresh) — give PDF.js another try.
    setPdfFailed(false)
  }, [signedUrl])

  function handlePdfError() {
    if (!hasRetried) {
      setHasRetried(true)
      onRefreshSignedUrl()
      return
    }
    setPdfFailed(true)
  }

  const usePdf = signedUrl != null && !pdfFailed

  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-white">
      {signedUrl == null && (
        <p className="border-b border-border bg-warning/10 px-md py-sm text-small text-warning">
          PDF preview unavailable — showing extracted text instead
        </p>
      )}
      <div className="min-h-0 flex-1">
        {usePdf ? (
          <PdfViewer url={signedUrl} targetPage={targetPage} onError={handlePdfError} />
        ) : (
          <TextViewer text={contractText} targetPage={targetPage} />
        )}
      </div>
      {signedUrl && (
        <a
          href={signedUrl}
          download
          className="border-t border-border px-md py-sm text-center text-body font-medium text-primary hover:underline"
        >
          Download PDF
        </a>
      )}
    </div>
  )
}
