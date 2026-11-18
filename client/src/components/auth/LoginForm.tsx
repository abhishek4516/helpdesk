
import { useId, useState, type FormEvent } from 'react'
import { login } from '../../services/authService'
import type { LoggedInUser } from '../../types/auth'

interface LoginFormProps {
  onLoginSuccess: (user: LoggedInUser) => void
}

const fieldShell =
  'group relative rounded-2xl border border-transparent bg-slate-100/80 transition-all duration-200 ' +
  'hover:bg-slate-100 focus-within:border-[#8686AC] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(134_134_172/0.16)] ' +
  'has-[input:disabled]:opacity-60 has-[input[aria-invalid=true]]:border-red-400 ' +
  'dark:bg-white/5 dark:hover:bg-white/8 dark:focus-within:bg-white/10'

const fieldLabel =
  'pointer-events-none absolute left-4 top-2.5 text-[11px] font-medium leading-none text-(--color-text-muted) transition-colors group-focus-within:text-[#505081] dark:group-focus-within:text-[#8686AC]'

const fieldInput =
  'h-14 w-full rounded-2xl bg-transparent pb-1.5 pl-4 pr-12 pt-5 text-sm font-semibold text-(--color-text) outline-none ' +
  'placeholder:font-normal placeholder:text-(--color-text-muted)/60 disabled:cursor-not-allowed'

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const errorId = useId()
  const canSubmit = !loading && identifier.trim() !== '' && password !== ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setError('')
    setLoading(true)

    try {
      const data = await login(identifier.trim(), password)

      if (!data.success || !data.user) {
        setError(
          data.message ||
            'Those details don’t match an account. Check your ID or email and password.',
        )
        return
      }

      setPassword('')
      onLoginSuccess(data.user)
    } catch {
      setError('Can’t reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading}
      className="w-full space-y-3"
    >
      <div className={fieldShell}>
        <label htmlFor="identifier" className={fieldLabel}>
          Employee ID or email
        </label>

        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          maxLength={254}
          disabled={loading}
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value)
            setError('')
          }}
          placeholder="Please enter your employee id"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldInput}
        />

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-muted) transition-colors group-focus-within:text-[#505081] dark:group-focus-within:text-[#8686AC]"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <circle cx="9" cy="11" r="2" />
          <path d="M5.5 16c.6-1.4 1.9-2 3.5-2s2.9.6 3.5 2M14.5 10h3M14.5 13.5h3" />
        </svg>
      </div>

      <div className={fieldShell}>
        <label htmlFor="password" className={fieldLabel}>
          Password
        </label>

        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          disabled={loading}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setError('')
          }}
          placeholder="Enter your password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldInput}
        />

        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          disabled={loading}
          className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-(--color-text-muted) outline-none transition-colors hover:text-[#505081] dark:hover:text-[#8686AC] focus-visible:ring-2 focus-visible:ring-[#8686AC]"
        >
          {showPassword ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.6 7.6C4.4 9.2 3 12 3 12s4 6 9 6c1.2 0 2.3-.3 3.3-.8" />
              <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span className="leading-5">{error}</span>
        </div>
      )}

      <div className="pt-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-[#272757] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgb(39_39_87/0.45)] outline-none transition-all duration-200 hover:bg-[#505081] hover:shadow-[0_12px_28px_-8px_rgb(80_80_129/0.5)] focus-visible:ring-4 focus-visible:ring-[#8686AC]/40 active:bg-[#0F0E47] disabled:cursor-not-allowed disabled:bg-[#272757]/50 disabled:shadow-none"
        >
          {loading ? (
            <>
              <svg
                className="h-5 w-5 animate-spin motion-reduce:animate-none"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </div>

      <p className="flex items-center justify-center gap-2 pt-2 text-xs text-(--color-text-muted)">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-[#505081] dark:text-[#8686AC]"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        For employees only. Your connection is encrypted.
      </p>
    </form>
  )
}
