'use client'

import { useRef, useState, type DragEvent } from 'react'

// Spec: docs/specs/upload-extraction.md
// Drag-and-drop + file picker; inline validation errors rendered immediately,
// before any network call. Design: card, 12px radius, #E2E8F0 border default,
// #AACCD6 accent border while drag-active.

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface UploadDropzoneProps {
  file: File | null
  onSelect: (file: File) => void
  error: string | null
}

export function UploadDropzone({ file, onSelect, error }: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSelect(candidate: File) {
    if (candidate.type !== 'application/pdf') {
      setLocalError('Only PDF files are supported.')
      return
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setLocalError(`This file is ${(candidate.size / 1024 / 1024).toFixed(1)}MB — the limit is 10MB.`)
      return
    }
    setLocalError(null)
    onSelect(candidate)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) validateAndSelect(dropped)
  }

  const displayedError = localError ?? error

  return (
    <div className="flex flex-col gap-xs">
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-card border-2 border-dashed px-lg py-2xl text-center transition duration-150 ease-out ${
          dragActive ? 'border-accent bg-accent-light/20' : 'border-border'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) validateAndSelect(selected)
          }}
        />
        {file ? (
          <p className="text-body text-text-primary">
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
          </p>
        ) : (
          <p className="text-body text-text-secondary">
            Drag and drop a PDF here, or click to browse (max 10MB)
          </p>
        )}
      </div>
      {displayedError && <p className="text-small text-error">{displayedError}</p>}
    </div>
  )
}
