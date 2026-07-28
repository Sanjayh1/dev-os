'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

// Spec: docs/specs/custom-terms.md
// Text input + "Add" button. Disables "Add" once 5 terms are reached.

const MAX_TERMS = 5
const MAX_LENGTH = 100

interface CustomTermInputProps {
  count: number
  onAdd: (term: string) => void
  error: string | null
}

export function CustomTermInput({ count, onAdd, error }: CustomTermInputProps) {
  const [draft, setDraft] = useState('')
  const atLimit = count >= MAX_TERMS

  function handleAdd() {
    if (atLimit || !draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }

  const addButton = (
    <Button type="button" variant="secondary" onClick={handleAdd} disabled={atLimit || !draft.trim()}>
      + Add Key Term
    </Button>
  )

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex gap-sm">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          maxLength={MAX_LENGTH}
          disabled={atLimit}
          placeholder="e.g. Non-compete radius"
          className="h-11 flex-1 rounded-input border border-border-strong bg-white px-md text-body text-text-primary placeholder:text-text-muted transition duration-150 ease-out focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        {atLimit ? <Tooltip content="Maximum 5 custom terms">{addButton}</Tooltip> : addButton}
      </div>
      {error && <p className="text-small text-error">{error}</p>}
    </div>
  )
}
