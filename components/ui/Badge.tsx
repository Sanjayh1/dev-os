import type { ReactNode } from 'react'

type BadgeVariant = 'custom' | 'edited' | 'completed' | 'processing' | 'failed' | 'draft'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
}

// Colors per skills/design-system/SKILL.md — Contract Status + custom/edited conventions
// from docs/specs/custom-terms.md and docs/specs/inline-editing.md.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  custom: 'bg-secondary text-white',
  edited: 'bg-bg-subtle text-text-secondary border border-border',
  completed: 'bg-status-completed/10 text-status-completed',
  processing: 'bg-status-processing/10 text-status-processing',
  failed: 'bg-status-failed/10 text-status-failed',
  draft: 'bg-status-draft/10 text-status-draft',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-sm py-xs text-small font-semibold ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  )
}
