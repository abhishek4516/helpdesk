
import type { LoggedInUser } from '../../types/auth'

interface WelcomeCardProps {
  user: LoggedInUser
  onLogout: () => void
}

export default function WelcomeCard({ user, onLogout }: WelcomeCardProps) {
  return (
    <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl sm:p-10">
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
        H
      </div>

      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
        Employee Helpdesk
      </p>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        Welcome, {user.name}
      </h1>

      <p className="mt-3 text-slate-600">
        You have successfully signed in.
      </p>

      <div className="mt-7 space-y-4 rounded-xl bg-slate-50 p-5">
        <div>
          <p className="text-sm text-slate-500">Employee ID</p>
          <p className="mt-1 font-semibold text-slate-900">
            {user.employeeId}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">Role</p>
          <p className="mt-1 font-semibold capitalize text-slate-900">
            {user.role.replace('_', ' ')}
          </p>
        </div>
      </div>

      {user.mustChangePassword && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You must change your temporary password before continuing.
        </div>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="mt-7 w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Log out
      </button>
    </section>
  )
}
