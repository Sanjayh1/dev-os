// Spec: docs/specs/results-display.md — rendered once at the top of every results page.
export function Disclaimer() {
  return (
    <p className="rounded-card border border-border bg-bg-subtle px-md py-sm text-small text-text-muted">
      This is an AI-assisted review tool, not legal advice. Always consult a qualified
      attorney before signing or relying on any contract terms.
    </p>
  )
}
