
import LoginForm from '../components/auth/LoginForm'
import type { LoggedInUser } from '../types/auth'

interface LoginPageProps {
  onLoginSuccess: (user: LoggedInUser) => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-7 flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-200">
          H
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
           Helpdesk
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Welcome back
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Sign in to manage your support requests and tickets.
        </p>

        <LoginForm onLoginSuccess={onLoginSuccess} />

        <p className="mt-7 text-center text-xs leading-5 text-slate-400">
          Secure access to your organization's helpdesk.
        </p>
      </section>
    </main>
  )
}
