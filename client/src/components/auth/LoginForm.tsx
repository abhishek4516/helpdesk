
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
      setError('Unable to connect to the server. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="identifier"
          className="block text-sm font-semibold text-(--color-text)"
        >
          Employee ID, name or email
        </label>

        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" className="h-5 w-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21a7 7 0 0 1 14 0" />
            </svg>
          </div>

          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter your employee ID or email"
            required
            maxLength={254}
            disabled={loading}
            className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) py-4 pl-12 pr-4 text-sm text-(--color-text) outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
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
        className="group flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor"
                strokeWidth="3" opacity=".25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" />
            </svg>
            Signing in...
          </>
        ) : (
          <>
            Sign in to your account
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 pt-1 text-xs text-(--color-text-muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" className="h-4 w-4 text-emerald-600">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="m10 15 1.5 1.5L14 14" />
        </svg>
        Secure employee access
        <span className="text-slate-300">·</span>
        Helpdesk Portal
      </div>
    </form>
  )
}
