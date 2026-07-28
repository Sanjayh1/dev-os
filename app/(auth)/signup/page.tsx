'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { isValidEmail, isValidPassword } from '@/lib/validation/auth'

// Spec: docs/specs/auth.md
const SLOW_REQUEST_MS = 10000

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSlow, setIsSlow] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address'
    if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters'
    if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsSubmitting(true)
    setIsSlow(false)
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS)

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    clearTimeout(slowTimer)
    setIsSubmitting(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      if (response.status === 409) {
        setFieldErrors((prev) => ({ ...prev, email: 'Email already registered' }))
      } else if (response.status === 429) {
        setFormError("You're trying too often — please wait a moment and try again.")
      } else {
        setFormError(body?.error?.message ?? 'Could not create your account. Please try again.')
      }
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-subtle px-lg">
      <div className="w-full max-w-sm rounded-card border border-border bg-white p-lg">
        <h1 className="text-h2 text-text-primary">Get started free</h1>
        <p className="mt-xs text-body text-text-secondary">
          Create an account to start reviewing contracts.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-lg flex flex-col gap-md">
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            required
          />
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />
          <Input
            id="confirmPassword"
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={fieldErrors.confirmPassword}
            required
          />

          {formError && <p className="text-small text-error">{formError}</p>}
          {isSlow && !formError && (
            <p className="text-small text-text-muted">
              Taking longer than usual — please wait a moment.
            </p>
          )}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-xs">
            {isSubmitting ? 'Creating account…' : 'Sign Up'}
          </Button>
        </form>

        <p className="mt-md text-center text-body text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
