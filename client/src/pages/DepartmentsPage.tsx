
import { useEffect, useState } from 'react'

interface Department {
  id: number
  name: string
  department_code: string
  is_active: number | boolean
  head_user_id: number | null
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch('http://localhost:5000/api/departments', {
          credentials: 'include',
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load departments')
        }

        setDepartments(data.departments)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load departments',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadDepartments()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Department Management
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          View and manage your organization's departments.
        </p>
      </div>

      {/* Departments table */}
      <section
        className="overflow-hidden rounded-xl border"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h2
              className="font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              All Departments
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {departments.length}{' '}
              {departments.length === 1 ? 'department' : 'departments'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div
            className="px-6 py-12 text-center text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <div
              className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Loading departments...
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-center">
            <p
              role="alert"
              className="text-sm"
              style={{ color: 'var(--color-danger-text)' }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-sm font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              Try again
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p
              className="font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              No departments found
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Departments will appear here once they are added.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead
                style={{
                  backgroundColor: 'var(--color-surface-secondary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <tr>
                  <th className="px-5 py-3 font-medium sm:px-6">
                    Department
                  </th>
                  <th className="px-5 py-3 font-medium sm:px-6">Code</th>
                  <th className="px-5 py-3 font-medium sm:px-6">
                    Department Head
                  </th>
                  <th className="px-5 py-3 font-medium sm:px-6">Status</th>
                </tr>
              </thead>

              <tbody>
                {departments.map((department) => {
                  const active =
                    department.is_active === true ||
                    department.is_active === 1

                  return (
                    <tr
                      key={department.id}
                      className="transition-colors hover:opacity-90"
                      style={{
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <td
                        className="px-5 py-4 font-medium sm:px-6"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {department.name}
                      </td>

                      <td
                        className="px-5 py-4 sm:px-6"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <span
                          className="rounded-md px-2 py-1 font-mono text-xs"
                          style={{
                            backgroundColor: 'var(--color-surface-secondary)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {department.department_code}
                        </span>
                      </td>

                      <td
                        className="px-5 py-4 sm:px-6"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {department.head_user_id ?? 'Not assigned'}
                      </td>

                      <td className="px-5 py-4 sm:px-6">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: active
                              ? 'var(--color-success-bg)'
                              : 'var(--color-surface-secondary)',
                            color: active
                              ? 'var(--color-success-text)'
                              : 'var(--color-text-secondary)',
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{
                              backgroundColor: active
                                ? 'var(--color-success-text)'
                                : 'var(--color-text-secondary)',
                            }}
                          />
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
