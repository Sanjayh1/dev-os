'use client'

import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useSubmitFeedback } from './useSubmitFeedback'

// Spec: docs/specs/feedback.md
// Thumbs up/down + optional comment, submits independently of other page
// actions. Ghost styling unselected, filled Secondary once a rating is
// picked. Disables re-submission for the same contract within the client
// session (not server-enforced at MVP — P2 scope).

const MAX_COMMENT_LENGTH = 1000

interface FeedbackWidgetProps {
  contractId: string
}

export function FeedbackWidget({ contractId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submitFeedback = useSubmitFeedback()

  function handleRate(next: 'up' | 'down') {
    setRating(next)
  }

  function handleSubmit() {
    if (!rating) return
    submitFeedback.mutate(
      { contractId, rating, comment: comment.trim() || undefined },
      { onSuccess: () => setSubmitted(true) }
    )
  }

  if (submitted) {
    return <p className="text-small text-text-secondary">Thanks for the feedback.</p>
  }

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center gap-sm">
        <span className="text-small text-text-secondary">Was this helpful?</span>
        <button
          type="button"
          onClick={() => handleRate('up')}
          aria-label="Thumbs up"
          className={`rounded-input p-xs transition duration-150 ease-out ${
            rating === 'up' ? 'bg-secondary text-white' : 'text-text-muted hover:text-secondary'
          }`}
        >
          <ThumbsUp size={18} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => handleRate('down')}
          aria-label="Thumbs down"
          className={`rounded-input p-xs transition duration-150 ease-out ${
            rating === 'down' ? 'bg-secondary text-white' : 'text-text-muted hover:text-secondary'
          }`}
        >
          <ThumbsDown size={18} strokeWidth={1.5} />
        </button>
      </div>

      {rating && (
        <div className="flex flex-col gap-xs">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Anything you'd like to add? (optional)"
            rows={2}
            className="w-full resize-none rounded-input border border-border-strong bg-white px-sm py-xs text-body text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-small text-text-muted">
              {comment.length}/{MAX_COMMENT_LENGTH}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitFeedback.isPending}
              className="rounded-input bg-secondary px-md py-xs text-body font-semibold text-white transition duration-150 ease-out hover:bg-secondary-hover disabled:opacity-50"
            >
              {submitFeedback.isPending ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
          {submitFeedback.isError && (
            <p className="text-small text-error">
              {submitFeedback.error instanceof Error
                ? submitFeedback.error.message
                : 'Failed to submit feedback.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
