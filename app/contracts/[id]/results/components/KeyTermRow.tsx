'use client'

import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ConfidenceIndicator } from '@/components/ui/ConfidenceIndicator'
import type { KeyTermData } from './useContractResults'
import { useEditKeyTerm } from './useEditKeyTerm'

// Spec: docs/specs/results-display.md + docs/specs/inline-editing.md
// Click-to-edit pattern (not a modal). Pencil icon on hover. Enter saves,
// Esc cancels. "Edited" badge appears once saved.

interface KeyTermRowProps {
  term: KeyTermData
  contractId: string
  onPageClick: (page: number) => void
}

export function KeyTermRow({ term, contractId, onPageClick }: KeyTermRowProps) {
  const [showWhy, setShowWhy] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(term.value)
  const [localError, setLocalError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const editKeyTerm = useEditKeyTerm(contractId)

  function startEditing() {
    cancelledRef.current = false
    setLocalError(null)
    setDraftValue(term.value)
    setIsEditing(true)
  }

  function commitOrRevert() {
    const trimmed = draftValue.trim()
    setIsEditing(false)

    if (!trimmed) {
      setLocalError('Value cannot be empty')
      setDraftValue(term.value)
      return
    }
    setLocalError(null)
    if (trimmed === term.value) return
    editKeyTerm.mutate({ keyTermId: term.id, value: trimmed })
  }

  function handleBlur() {
    if (cancelledRef.current) {
      setIsEditing(false)
      setDraftValue(term.value)
      return
    }
    commitOrRevert()
  }

  return (
    <tr className="border-b border-border hover:bg-bg-subtle">
      <td className="px-md py-sm align-top text-body text-text-primary">{term.term_name}</td>
      <td className="px-md py-sm align-top text-body text-text-primary">
        {isEditing ? (
          <input
            autoFocus
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                cancelledRef.current = true
                e.currentTarget.blur()
              }
            }}
            onBlur={handleBlur}
            className="h-11 w-full rounded-input border border-primary bg-white px-sm text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <div className="group flex flex-wrap items-baseline gap-xs">
            <span>{term.value}</span>
            <button
              type="button"
              onClick={startEditing}
              aria-label="Edit value"
              className="text-text-muted opacity-0 transition duration-150 ease-out hover:text-primary group-hover:opacity-100"
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="text-small font-medium text-primary hover:underline"
            >
              Why?
            </button>
          </div>
        )}
        {localError && <p className="mt-xs text-small text-error">{localError}</p>}
        {editKeyTerm.isError && (
          <p className="mt-xs text-small text-error">
            {editKeyTerm.error instanceof Error ? editKeyTerm.error.message : 'Failed to save your edit.'}
          </p>
        )}
        {showWhy && !isEditing && (
          <p className="mt-xs rounded-input bg-bg-subtle p-sm text-small italic text-text-secondary">
            &ldquo;{term.source_sentence}&rdquo;
          </p>
        )}
      </td>
      <td className="px-md py-sm align-top text-body">
        <button
          type="button"
          onClick={() => onPageClick(term.page_number)}
          className="text-primary hover:underline"
        >
          {term.page_number}
        </button>
      </td>
      <td className="px-md py-sm align-top">
        <ConfidenceIndicator score={term.confidence_score} />
      </td>
      <td className="px-md py-sm align-top">
        <div className="flex gap-xs">
          {term.is_custom && <Badge variant="custom">Custom</Badge>}
          {term.is_edited && <Badge variant="edited">Edited</Badge>}
        </div>
      </td>
    </tr>
  )
}
