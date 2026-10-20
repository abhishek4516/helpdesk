
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
      const data = await login(identifier, password)

      if (!data.success || !data.user) {
        setError(data.message || 'Unable to sign in. Please try again.')
        return
      }

      setPassword('')
      onLoginSuccess(data.user)
    } catch {
      setError(
        'Unable to connect to the server. Make sure the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="identifier"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Employee ID or email
        </label>

        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Enter your Employee ID"
          required
          maxLength={254}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <PasswordInput
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
