
import { useState, type FormEvent } from 'react'
import { login } from '../../services/authService'
import type { LoggedInUser } from '../../types/auth'
import PasswordInput from './PasswordInput'

interface LoginFormProps {
  onLoginSuccess: (user: LoggedInUser) => void
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(identifier.trim(), password)

      if (!data.success || !data.user) {
        setError(data.message || 'Unable to sign in. Please check your details.')
        return
      }

      setPassword('')
      onLoginSuccess(data.user)
    } catch {
      setError(
        'Unable to connect to the server. Please check your connection.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="identifier"
          className="block text-sm font-semibold text-(--color-text)"
        >
          Employee ID, name or email
        </label>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21a7 7 0 0 1 14 0" />
            </svg>
          </span>

          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter your ID, name or email"
            required
            maxLength={254}
            disabled={loading}
            className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) py-3.5 pl-12 pr-4 text-sm text-(--color-text) outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 h-5 w-5 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !identifier.trim() || !password}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <svg
              className="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="3"
                opacity=".25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Signing in...
          </>
        ) : (
          <>
            Sign in
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      <p className="text-center text-xs text-(--color-text-muted)">
        Secure employee access · Helpdesk Portal
      </p>
    </form>
  )
}
