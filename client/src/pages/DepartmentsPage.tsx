
import { useCallback, useEffect, useState } from 'react'

const API = 'http://localhost:5000/api'

interface Department {
  id: number
  name: string
  department_code: string
  head_user_id: number | null
  head_name: string | null
  is_active: number | boolean
}

interface Employee {
  id: number
  employeeId: string
  name: string
  role: 'master' | 'department_head' | 'employee'
  departmentId: number | null
  isActive: boolean
}

interface ApiResponse {
  success: boolean
  message?: string
  departments?: Department[]
  employees?: Employee[]
}

const surface = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [departmentCode, setDepartmentCode] = useState('')

  const [selectedHeads, setSelectedHeads] = useState<Record<number, string>>(
    {},
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [departmentResponse, employeeResponse] = await Promise.all([
        fetch(`${API}/departments`, { credentials: 'include' }),
        fetch(`${API}/employees/assignable`, { credentials: 'include' }),
      ])

      const departmentData: ApiResponse = await departmentResponse.json()
      const employeeData: ApiResponse = await employeeResponse.json()

      if (!departmentResponse.ok || !departmentData.success) {
        throw new Error(
          departmentData.message || 'Unable to load departments.',
        )
      }

      if (!employeeResponse.ok || !employeeData.success) {
        throw new Error(
          employeeData.message || 'Unable to load employees.',
        )
      }

      setDepartments(departmentData.departments || [])
      setEmployees(employeeData.employees || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load data.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function sendRequest(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ) {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data: ApiResponse = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'The operation could not be completed.')
    }

    return data
  }

  function openCreateForm() {
    setEditingId(null)
    setName('')
    setDepartmentCode('')
    setShowForm(true)
    setNotice('')
    setError('')
  }

  function openEditForm(department: Department) {
    setEditingId(department.id)
    setName(department.name)
    setDepartmentCode(department.department_code)
    setShowForm(true)
    setNotice('')
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setDepartmentCode('')
  }

  async function handleSaveDepartment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim() || !departmentCode.trim()) {
      setError('Department name and code are required.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const editing = editingId !== null

      await sendRequest(
        editing
          ? `${API}/departments/${editingId}`
          : `${API}/departments`,
        editing ? 'PUT' : 'POST',
        {
          name: name.trim(),
          department_code: departmentCode.trim().toUpperCase(),
        },
      )

      closeForm()
      setNotice(
        editing
          ? 'Department updated successfully.'
          : 'Department created successfully.',
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save department.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignHead(department: Department) {
    const headUserId = selectedHeads[department.id]

    if (!headUserId) {
      setError('Please select a department head first.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await sendRequest(
        `${API}/departments/${department.id}/head`,
        'PATCH',
        { head_user_id: Number(headUserId) },
      )

      setNotice('Department head assigned successfully.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to assign department head.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveHead(department: Department) {
    if (!window.confirm(
      `Remove ${department.head_name || 'the current head'} from ${department.name}?`,
    )) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await sendRequest(
        `${API}/departments/${department.id}/head`,
        'DELETE',
      )

      setNotice('Department head removed successfully.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to remove department head.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(department: Department) {
    const active = Boolean(department.is_active)

    if (!window.confirm(
      `${active ? 'Deactivate' : 'Activate'} ${department.name}?`,
    )) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await sendRequest(
        `${API}/departments/${department.id}/status`,
        'PATCH',
        { is_active: !active },
      )

      setNotice(
        `Department ${active ? 'deactivated' : 'activated'} successfully.`,
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update department.',
      )
    } finally {
      setSaving(false)
    }
  }

  const activeCount = departments.filter(
    (department) => Boolean(department.is_active),
  ).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
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
            Create departments and manage department heads.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          + Add Department
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={surface}>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Total Departments
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {departments.length}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={surface}>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Active Departments
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {activeCount}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger-text)',
            color: 'var(--color-danger-text)',
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-3 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-success-text)',
            backgroundColor: 'var(--color-success-bg)',
          }}
        >
          {notice}
        </div>
      )}

      {showForm && (
        <section
          className="rounded-xl border p-5"
          style={surface}
        >
          <h2 className="mb-4 font-semibold">
            {editingId ? 'Edit Department' : 'Create Department'}
          </h2>

          <form onSubmit={handleSaveDepartment} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Department Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  placeholder="e.g. Maintenance"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={surface}
                />
              </label>

              <label className="block">
                <span
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Department Code
                </span>
                <input
                  value={departmentCode}
                  onChange={(e) =>
                    setDepartmentCode(e.target.value.toUpperCase())
                  }
                  maxLength={30}
                  required
                  placeholder="e.g. MAINT"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm uppercase outline-none"
                  style={surface}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Department'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                style={surface}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section
        className="overflow-hidden rounded-xl border"
        style={surface}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h2 className="font-semibold">All Departments</h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {departments.length} departments
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading || saving}
            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={surface}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div
            className="px-6 py-12 text-center text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Loading departments...
          </div>
        ) : departments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">No departments found</p>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Create your first department to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead
                style={{
                  backgroundColor: 'var(--color-surface-secondary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <tr>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Department Head</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {departments.map((department) => {
                  const active = Boolean(department.is_active)

                  const eligibleHeads = employees.filter(
                    (employee) =>
                      employee.role === 'department_head' &&
                      employee.departmentId === department.id &&
                      employee.isActive,
                  )

                  return (
                    <tr
                      key={department.id}
                      style={{ borderTop: '1px solid var(--color-border)' }}
                    >
                      <td className="px-5 py-4 font-medium">
                        {department.name}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="rounded-md px-2 py-1 font-mono text-xs"
                          style={{
                            backgroundColor: 'var(--color-surface-secondary)',
                          }}
                        >
                          {department.department_code}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <p
                            className="font-medium"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {department.head_name || 'Not assigned'}
                          </p>

                          {active && (
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedHeads[department.id] || ''}
                                onChange={(e) =>
                                  setSelectedHeads((previous) => ({
                                    ...previous,
                                    [department.id]: e.target.value,
                                  }))
                                }
                                disabled={saving}
                                className="max-w-[190px] rounded-lg border px-2 py-2 text-xs outline-none"
                                style={surface}
                              >
                                <option value="">Select head</option>
                                {eligibleHeads.map((employee) => (
                                  <option
                                    key={employee.id}
                                    value={employee.id}
                                  >
                                    {employee.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => void handleAssignHead(department)}
                                disabled={
                                  saving ||
                                  !selectedHeads[department.id]
                                }
                                className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                style={{
                                  backgroundColor: 'var(--color-accent)',
                                }}
                              >
                                Assign
                              </button>
                            </div>
                          )}

                          {department.head_user_id !== null && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveHead(department)}
                              disabled={saving}
                              className="text-xs font-medium underline disabled:opacity-50"
                              style={{
                                color: 'var(--color-danger-text)',
                              }}
                            >
                              Remove head
                            </button>
                          )}

                          {active && eligibleHeads.length === 0 && (
                            <p
                              className="text-xs"
                              style={{
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              No eligible department heads
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
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

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(department)}
                            disabled={saving}
                            className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50"
                            style={surface}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(department)}
                            disabled={saving}
                            className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50"
                            style={{
                              borderColor: 'var(--color-border)',
                              color: active
                                ? 'var(--color-danger-text)'
                                : 'var(--color-success-text)',
                            }}
                          >
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
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
