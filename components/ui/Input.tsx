import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

// Spec: docs/specs/auth.md — 44px height, #CBD5E1 border, #112E81 focus border.
export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-body font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        className={`h-11 rounded-input border bg-white px-md text-body text-text-primary placeholder:text-text-muted transition duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          error ? 'border-error focus:border-error' : 'border-border-strong focus:border-primary'
        } ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-small text-error">
          {error}
        </p>
      )}
    </div>
  )
}
