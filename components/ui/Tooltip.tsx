import type { ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

// CSS-only (group-hover) so this stays a Server Component — no client-side
// event handlers needed for a simple hover tooltip.
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-xs -translate-x-1/2 whitespace-nowrap rounded-input bg-primary px-sm py-xs text-small text-white opacity-0 transition duration-150 ease-out group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
