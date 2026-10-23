
import { useCallback, useEffect, useState } from 'react'

type Role = 'master' | 'department_head' | 'employee'

interface Employee {
  id: number
  employeeId: string
  name: string
  email: string | null
  role: Role
  departmentId: number | null
  isActive: boolean
  mustChangePassword: boolean
}

interface Department {
  id: number
  name: string
  department_code: string
  is_active: number | boolean
}

interface EmployeeForm {
  employeeId: string
  name: string
  email: string
  role: Role
  departmentId: string
}

const emptyForm: EmployeeForm = {
  employeeId: '',
  name: '',
  email: '',
  role: 'employee',
  departmentId: '',
}

const buttonStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '9px',
  padding: '9px 13px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: '9px',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
}

function roleLabel(role: Role) {
  if (role === 'master') return 'Master'
  if (role === 'department_head') return 'Department Head'
  return 'Employee'
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [passwordEmployeeId, setPasswordEmployeeId] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [employeeResponse, departmentResponse] = await Promise.all([
        fetch('http://localhost:5000/api/employees', {
          credentials: 'include',
        }),
        fetch('http://localhost:5000/api/departments', {
          credentials: 'include',
        }),
      ])

      const employeeData = await employeeResponse.json()
      const departmentData = await departmentResponse.json()

      if (!employeeResponse.ok || !employeeData.success) {
        throw new Error(
          employeeData.message || 'Unable to load employees.',
        )
      }

      if (!departmentResponse.ok || !departmentData.success) {
        throw new Error(
          departmentData.message || 'Unable to load departments.',
        )
      }

      setEmployees(employeeData.employees)
      setDepartments(departmentData.departments)
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

  const getDepartmentName = (id: number | null) => {
    if (id === null) return 'No department'
    return departments.find((department) => department.id === id)?.name
      ?? 'Unknown department'
  }

  const filteredEmployees = employees.filter((employee) => {
    const term = search.trim().toLowerCase()

    const matchesSearch =
      !term ||
      employee.name.toLowerCase().includes(term) ||
      employee.employeeId.toLowerCase().includes(term) ||
      (employee.email ?? '').toLowerCase().includes(term)

    const matchesDepartment =
      departmentFilter === 'all' ||
      String(employee.departmentId ?? '') === departmentFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && employee.isActive) ||
      (statusFilter === 'inactive' && !employee.isActive)

    return matchesSearch && matchesDepartment && matchesStatus
  })

  const openCreateForm = () => {
    setEditingEmployee(null)
    setForm(emptyForm)
    setError('')
    setNotice('')
    setShowForm(true)
  }

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee)
    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email ?? '',
      role: employee.role,
      departmentId:
        employee.departmentId === null
          ? ''
          : String(employee.departmentId),
    })
    setError('')
    setNotice('')
    setShowForm(true)
  }

  const closeForm = () => {
    if (saving) return
    setShowForm(false)
    setEditingEmployee(null)
    setForm(emptyForm)
  }

  const updateField = <K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    setTemporaryPassword('')
    setPasswordEmployeeId('')
    setPasswordMessage('')

    try {
      const payload = {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        departmentId: form.departmentId
          ? Number(form.departmentId)
          : null,
      }

      const url = editingEmployee
        ? `http://localhost:5000/api/employees/${editingEmployee.id}`
        : 'http://localhost:5000/api/employees'

      const response = await fetch(url, {
        method: editingEmployee ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to save employee.')
      }

      if (editingEmployee) {
        setNotice('Employee details updated successfully.')
      } else {
        setTemporaryPassword(data.temporaryPassword)
        setPasswordEmployeeId(data.employee.employeeId)
        setPasswordMessage(
          'Employee created. Copy the temporary password now and share it securely.',
        )
      }

      setShowForm(false)
      setEditingEmployee(null)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save employee.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (employee: Employee) => {
    if (
      !window.confirm(
        `Deactivate ${employee.name} (${employee.employeeId})? Their ticket history will be preserved.`,
      )
    ) {
      return
    }

    setError('')
    setNotice('')

    try {
      const response = await fetch(
        `http://localhost:5000/api/employees/${employee.id}/deactivate`,
        {
          method: 'PATCH',
          credentials: 'include',
        },
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to deactivate employee.')
      }

      setNotice(data.message)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to deactivate employee.',
      )
    }
  }

  const handleResetPassword = async (employee: Employee) => {
    if (
      !window.confirm(
        `Generate a new temporary password for ${employee.name}? Their existing sessions will be invalidated.`,
      )
    ) {
      return
    }

    setError('')
    setNotice('')
    setTemporaryPassword('')
    setPasswordEmployeeId('')
    setPasswordMessage('')

    try {
      const response = await fetch(
        `http://localhost:5000/api/employees/${employee.id}/reset-password`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to reset password.')
      }

      setTemporaryPassword(data.temporaryPassword)
      setPasswordEmployeeId(data.employeeId)
      setPasswordMessage(
        'Temporary password generated. Copy it now and share it securely.',
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset password.',
      )
    }
  }

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setNotice('Temporary password copied to clipboard.')
    } catch {
      setError(
        'Clipboard access failed. Select and copy the password manually.',
      )
    }
  }

  const activeCount = employees.filter((employee) => employee.isActive).length
  const inactiveCount = employees.length - activeCount

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        color: 'var(--color-text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '25px', fontWeight: 700, margin: 0 }}>
            Employee Management
          </h1>
          <p
            style={{
              margin: '7px 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: '14px',
            }}
          >
            Create accounts, manage employee details, and reset passwords.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          style={{
            ...buttonStyle,
            background: 'var(--color-accent)',
            color: '#fff',
            borderColor: 'var(--color-accent)',
          }}
        >
          + Add Employee
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '14px',
        }}
      >
        {[
          { label: 'Total employees', value: employees.length },
          { label: 'Active accounts', value: activeCount },
          { label: 'Inactive accounts', value: inactiveCount },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '13px',
              padding: '18px',
              background: 'var(--color-surface)',
            }}
          >
            <p
              style={{
                margin: 0,
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '27px',
                fontWeight: 700,
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '13px 15px',
            borderRadius: '10px',
            background: 'var(--color-danger-bg, var(--color-surface-secondary))',
            color: 'var(--color-danger-text)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            padding: '13px 15px',
            borderRadius: '10px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success-text)',
            fontSize: '14px',
          }}
        >
          {notice}
        </div>
      )}

      {temporaryPassword && (
        <section
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '13px',
            padding: '18px',
            background: 'var(--color-surface)',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700 }}>
            Temporary password
          </h2>
          <p
            style={{
              margin: '0 0 14px',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
            }}
          >
            {passwordMessage} Employee ID: {passwordEmployeeId}. This password
            will not be shown again after you leave this page.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <code
              style={{
                padding: '11px 13px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-secondary)',
                fontSize: '15px',
                overflowWrap: 'anywhere',
                userSelect: 'all',
              }}
            >
              {temporaryPassword}
            </code>
            <button
              type="button"
              onClick={copyTemporaryPassword}
              style={{
                ...buttonStyle,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              Copy password
            </button>
            <button
              type="button"
              onClick={() => {
                setTemporaryPassword('')
                setPasswordEmployeeId('')
                setPasswordMessage('')
              }}
              style={{
                ...buttonStyle,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      <section
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '13px',
          overflow: 'hidden',
          background: 'var(--color-surface)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '17px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <input
            aria-label="Search employees"
            placeholder="Search name, Employee ID, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ ...inputStyle, flex: '1 1 230px', width: 'auto' }}
          />

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            style={{ ...inputStyle, flex: '0 1 190px', width: 'auto' }}
          >
            <option value="all">All departments</option>
            {departments
              .filter(
                (department) =>
                  department.is_active === true ||
                  department.is_active === 1,
              )
              .map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
          </select>

          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ ...inputStyle, flex: '0 1 155px', width: 'auto' }}
          >
            <option value="active">Active accounts</option>
            <option value="inactive">Inactive accounts</option>
            <option value="all">All accounts</option>
          </select>

          <button
            type="button"
            onClick={() => void loadData()}
            style={{
              ...buttonStyle,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ padding: '25px', color: 'var(--color-text-secondary)' }}>
            Loading employees...
          </p>
        ) : filteredEmployees.length === 0 ? (
          <p style={{ padding: '25px', color: 'var(--color-text-secondary)' }}>
            No employees match your filters.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--color-surface-secondary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {[
                    'Employee',
                    'Employee ID',
                    'Department',
                    'Role',
                    'Status',
                    'Actions',
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: '13px 15px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      opacity: employee.isActive ? 1 : 0.72,
                    }}
                  >
                    <td style={{ padding: '15px', minWidth: '190px' }}>
                      <div style={{ fontWeight: 600 }}>{employee.name}</div>
                      <div
                        style={{
                          marginTop: '4px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {employee.email || 'No email'}
                      </div>
                    </td>
                    <td style={{ padding: '15px', whiteSpace: 'nowrap' }}>
                      {employee.employeeId}
                    </td>
                    <td style={{ padding: '15px', whiteSpace: 'nowrap' }}>
                      {getDepartmentName(employee.departmentId)}
                    </td>
                    <td style={{ padding: '15px', whiteSpace: 'nowrap' }}>
                      {roleLabel(employee.role)}
                    </td>
                    <td style={{ padding: '15px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '5px 9px',
                          borderRadius: '20px',
                          background: employee.isActive
                            ? 'var(--color-success-bg)'
                            : 'var(--color-surface-secondary)',
                          color: employee.isActive
                            ? 'var(--color-success-text)'
                            : 'var(--color-text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 15px', minWidth: '200px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                        <button
                          type="button"
                          onClick={() => openEditForm(employee)}
                          style={{
                            ...buttonStyle,
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        >
                          Edit
                        </button>
                        {employee.isActive && employee.id !== 1 && (
                          <button
                            type="button"
                            onClick={() => void handleResetPassword(employee)}
                            style={{
                              ...buttonStyle,
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                            }}
                          >
                            Reset password
                          </button>
                        )}
                        {employee.isActive && (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(employee)}
                            style={{
                              ...buttonStyle,
                              background: 'var(--color-surface)',
                              color: 'var(--color-danger-text)',
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            padding: '13px 17px',
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
          }}
        >
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>
      </section>

      {showForm && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.55)',
            overflowY: 'auto',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid var(--color-border)',
              borderRadius: '15px',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '15px',
                marginBottom: '22px',
              }}
            >
              <div>
                <h2
                  id="employee-form-title"
                  style={{ margin: 0, fontSize: '21px', fontWeight: 700 }}
                >
                  {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--color-text-secondary)',
                    fontSize: '13px',
                  }}
                >
                  {editingEmployee
                    ? 'Update the employee account details.'
                    : 'A random temporary password will be generated automatically.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close form"
                onClick={closeForm}
                style={{
                  ...buttonStyle,
                  alignSelf: 'flex-start',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '17px',
                }}
              >
                <label>
                  <span style={labelStyle}>Employee ID *</span>
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{1,20}"
                    maxLength={20}
                    value={form.employeeId}
                    onChange={(event) =>
                      updateField('employeeId', event.target.value)
                    }
                    style={inputStyle}
                    placeholder="e.g. 100002"
                  />
                </label>

                <label>
                  <span style={labelStyle}>Full name *</span>
                  <input
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    style={inputStyle}
                    placeholder="Employee full name"
                  />
                </label>

                <label>
                  <span style={labelStyle}>Email address</span>
                  <input
                    type="email"
                    maxLength={255}
                    value={form.email}
                    onChange={(event) =>
                      updateField('email', event.target.value)
                    }
                    style={inputStyle}
                    placeholder="employee@example.com"
                  />
                </label>

                <label>
                  <span style={labelStyle}>Role *</span>
                  <select
                    required
                    value={form.role}
                    onChange={(event) =>
                      updateField('role', event.target.value as Role)
                    }
                    style={inputStyle}
                  >
                    <option value="employee">Employee</option>
                    <option value="department_head">Department Head</option>
                    <option value="master">Master</option>
                  </select>
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={labelStyle}>Department</span>
                  <select
                    value={form.departmentId}
                    required={form.role !== 'master'}
                    onChange={(event) =>
                      updateField('departmentId', event.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="">
                      {form.role === 'master'
                        ? 'No department'
                        : 'Select department'}
                    </option>
                    {departments
                      .filter(
                        (department) =>
                          department.is_active === true ||
                          department.is_active === 1,
                      )
                      .map((department) => (
                        <option
                          key={department.id}
                          value={String(department.id)}
                        >
                          {department.name} ({department.department_code})
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {error && (
                <p
                  role="alert"
                  style={{
                    margin: '16px 0 0',
                    color: 'var(--color-danger-text)',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                }}
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-accent)',
                    color: '#fff',
                    borderColor: 'var(--color-accent)',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? 'Saving...'
                    : editingEmployee
                      ? 'Save Changes'
                      : 'Create Employee'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
