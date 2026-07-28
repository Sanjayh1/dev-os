'use client'

import { Button } from '@/components/ui/Button'

// Spec: docs/specs/key-term-extraction.md
// 3-step indicator: extracting (already done pre-process) → analysing with AI
// (mutation pending) → compiling results (mutation success, briefly, before
// redirect). Error state shows a failure message + retry CTA that re-invokes
// /process without re-upload — no client-side timers guessing duration.

type ProcessingState = 'pending' | 'success' | 'error'

interface ProcessingProgressProps {
  state: ProcessingState
  errorMessage: string | null
  onRetry: () => void
}

const STEPS = ['Extracting text', 'Analysing with AI', 'Compiling results']

export function ProcessingProgress({ state, errorMessage, onRetry }: ProcessingProgressProps) {
  if (state === 'error') {
    return (
      <div className="flex flex-col gap-sm rounded-card border border-border bg-white p-md">
        <p className="text-body font-medium text-error">
          {errorMessage ?? 'Something went wrong while processing this contract.'}
        </p>
        <Button variant="secondary" onClick={onRetry} className="self-start">
          Try again
        </Button>
      </div>
    )
  }

  const activeIndex = state === 'success' ? 2 : 1

  return (
    <ol className="flex flex-col gap-sm rounded-card border border-border bg-white p-md">
      {STEPS.map((step, index) => {
        const done = index < activeIndex || (state === 'success' && index === activeIndex)
        const active = index === activeIndex && state !== 'success'
        return (
          <li key={step} className="flex items-center gap-sm text-body">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-small font-semibold ${
                done
                  ? 'bg-success text-white'
                  : active
                    ? 'bg-primary text-white'
                    : 'bg-bg-subtle text-text-muted'
              }`}
            >
              {done ? '✓' : index + 1}
            </span>
            <span className={done || active ? 'text-text-primary' : 'text-text-muted'}>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}
