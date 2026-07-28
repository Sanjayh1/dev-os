'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { isValidEmail } from '@/lib/validation/auth'

// Spec: docs/specs/auth.md
const SLOW_REQUEST_MS = 10000

interface FieldErrors {
  email?: string
  password?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSlow, setIsSlow] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address'
    if (!password) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setResetMessage(null)
    if (!validate()) return

    setIsSubmitting(true)
    setIsSlow(false)
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_REQUEST_MS)

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    clearTimeout(slowTimer)
    setIsSubmitting(false)

    if (!response.ok) {
      if (response.status === 429) {
        setFormError("You're trying too often — please wait a moment and try again.")
      } else {
        // Never reveal which field is wrong — prevents user enumeration.
        setFormError('Invalid email or password')
      }
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword() {
    setFormError(null)
    setResetMessage(null)

    if (!isValidEmail(email)) {
      setFieldErrors((prev) => ({ ...prev, email: 'Enter your email above, then click "Forgot password?"' }))
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setFormError(error.message)
      return
    }

    setResetMessage('Password reset email sent — check your inbox.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-subtle px-lg">
      <div className="w-full max-w-sm rounded-card border border-border bg-white p-lg">
        <h1 className="text-h2 text-text-primary">Log in</h1>
        <p className="mt-xs text-body text-text-secondary">
          Welcome back — enter your details to continue.
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />

          <button
            type="button"
            onClick={handleForgotPassword}
            className="self-start text-small font-semibold text-primary transition duration-150 ease-out hover:text-primary-hover"
          >
            Forgot password?
          </button>

          {formError && <p className="text-small text-error">{formError}</p>}
          {resetMessage && <p className="text-small text-success">{resetMessage}</p>}
          {isSlow && !formError && (
            <p className="text-small text-text-muted">
              Taking longer than usual — please wait a moment.
            </p>
          )}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-xs">
            {isSubmitting ? 'Logging in…' : 'Log In'}
          </Button>
        </form>

        <p className="mt-md text-center text-body text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:text-primary-hover">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
