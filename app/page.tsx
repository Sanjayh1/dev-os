import Link from 'next/link'

const FEATURES = [
  {
    title: 'Key term extraction',
    description:
      'GPT-4o extracts 10-12 standard NDA/MSA terms with page attribution and a confidence score on every value.',
  },
  {
    title: 'Grounded contract chat',
    description:
      'Ask questions about your contract and get answers cited to the exact page — never outside knowledge.',
  },
  {
    title: 'Inline correction',
    description:
      'Fix an extracted value in place. Every edit is tracked to keep the model accountable over time.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-lg py-md border-b border-border">
        <span className="text-h4 font-semibold text-primary">ContractIQ</span>
        <nav className="flex items-center gap-md">
          <Link href="/login" className="text-body text-text-secondary hover:text-primary transition duration-150 ease-out">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-input bg-primary px-md py-sm text-body font-semibold text-white hover:bg-primary-hover transition duration-150 ease-out"
          >
            Get Started Free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-lg py-3xl text-center">
        <h1 className="text-display text-text-primary">
          Understand your contracts in minutes, not hours.
        </h1>
        <p className="mt-md text-body-lg text-text-secondary">
          Upload an NDA or MSA, get key terms extracted with page-level citations and confidence
          scores, then ask follow-up questions grounded in the actual document — no legal
          background required.
        </p>
        <div className="mt-lg flex items-center justify-center gap-md">
          <Link
            href="/signup"
            className="rounded-input bg-primary px-xl py-sm text-body-lg font-semibold text-white hover:bg-primary-hover transition duration-150 ease-out"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="rounded-input border border-border-strong px-xl py-sm text-body-lg font-semibold text-text-primary hover:border-primary transition duration-150 ease-out"
          >
            Log In
          </Link>
        </div>
        <p className="mt-md text-small text-text-muted">
          Not legal advice. ContractIQ helps you understand contracts faster — it does not replace counsel.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-lg pb-3xl">
        <div className="grid gap-md sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-card border border-border bg-white p-lg">
              <h3 className="text-h4 text-text-primary">{feature.title}</h3>
              <p className="mt-sm text-body text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
