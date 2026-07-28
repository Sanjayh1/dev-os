// Spec: docs/specs/dashboard.md — Contract Status badge colors.
// contracts.status is 'uploaded' | 'processing' | 'completed' | 'error';
// the design system's badge variants use 'draft'/'failed' terminology for
// the first and last of those respectively.

export type StatusBadgeVariant = 'completed' | 'processing' | 'failed' | 'draft'

export function getStatusBadge(status: string): { variant: StatusBadgeVariant; label: string } {
  switch (status) {
    case 'completed':
      return { variant: 'completed', label: 'Completed' }
    case 'processing':
      return { variant: 'processing', label: 'Processing' }
    case 'error':
      return { variant: 'failed', label: 'Failed' }
    default:
      return { variant: 'draft', label: 'Draft' }
  }
}
