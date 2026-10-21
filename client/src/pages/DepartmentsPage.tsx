
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

    loadDepartments()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Department Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your organization's departments.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            All Departments
          </h2>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500">
            Loading departments...
          </p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{error}</p>
        ) : departments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No departments found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Department Head</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {departments.map((department) => {
                  const active =
                    department.is_active === true ||
                    department.is_active === 1

                  return (
                    <tr key={department.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {department.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {department.department_code}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {department.head_user_id ?? 'Not assigned'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
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
      </div>
    </div>
  )
}
