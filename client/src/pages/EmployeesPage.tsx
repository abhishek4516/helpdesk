import { useCallback, useEffect, useMemo, useState } from 'react'

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

const buttonBase: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '9px 13px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 150ms ease, border-color 150ms ease, opacity 150ms ease',
}

const inputBase: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '11px 13px',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelBase: React.CSSProperties = {
  display: 'block',
  marginBottom: 7,
  color: 'var(--color-text)',
  fontSize: 12,
  fontWeight: 650,
}

function roleLabel(role: Role) {
  if (role === 'master') return 'Master'
  if (role === 'department_head') return 'Department Head'
  return 'Employee'
}

function isDepartmentActive(department: Department) {
  return department.is_active === true || department.is_active === 1
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
        fetch('http://localhost:5000/api/employees', { credentials: 'include' }),
        fetch('http://localhost:5000/api/departments', { credentials: 'include' }),
      ])

      const employeeData = await employeeResponse.json()
      const departmentData = await departmentResponse.json()

      if (!employeeResponse.ok || !employeeData.success) {
        throw new Error(employeeData.message || 'Unable to load employees.')
      }
      if (!departmentResponse.ok || !departmentData.success) {
        throw new Error(departmentData.message || 'Unable to load departments.')
      }

      setEmployees(employeeData.employees)
      setDepartments(departmentData.departments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const getDepartmentName = (id: number | null) => {
    if (id === null) return 'No department'
    return departments.find((department) => department.id === id)?.name ?? 'Unknown department'
  }

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees.filter((employee) => {
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
  }, [employees, search, departmentFilter, statusFilter])

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
      departmentId: employee.departmentId === null ? '' : String(employee.departmentId),
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

  const updateField = <K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) => {
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
        ...(editingEmployee ? { employeeId: form.employeeId.trim() } : {}),
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
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
        setPasswordMessage('Employee created. Copy the temporary password now and share it securely.')
      }

      setShowForm(false)
      setEditingEmployee(null)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (employee: Employee) => {
    if (!window.confirm(`Deactivate ${employee.name} (${employee.employeeId})? Their ticket history will be preserved.`)) return

    setError('')
    setNotice('')
    try {
      const response = await fetch(`http://localhost:5000/api/employees/${employee.id}/deactivate`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to deactivate employee.')
      setNotice(data.message)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate employee.')
    }
  }

  const handleResetPassword = async (employee: Employee) => {
    if (!window.confirm(`Generate a new temporary password for ${employee.name}? Their existing sessions will be invalidated.`)) return

    setError('')
    setNotice('')
    setTemporaryPassword('')
    setPasswordEmployeeId('')
    setPasswordMessage('')

    try {
      const response = await fetch(`http://localhost:5000/api/employees/${employee.id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to reset password.')

      setTemporaryPassword(data.temporaryPassword)
      setPasswordEmployeeId(data.employeeId)
      setPasswordMessage('Temporary password generated. Copy it now and share it securely.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.')
    }
  }

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setNotice('Temporary password copied to clipboard.')
    } catch {
      setError('Clipboard access failed. Select and copy the password manually.')
    }
  }

  const activeCount = employees.filter((employee) => employee.isActive).length
  const inactiveCount = employees.length - activeCount
  const activeDepartments = departments.filter(isDepartmentActive)

  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    background: 'var(--color-surface)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  }

  const actionButton = (tone: 'default' | 'danger' = 'default'): React.CSSProperties => ({
    ...buttonBase,
    background: 'var(--color-surface)',
    color: tone === 'danger' ? 'var(--color-danger-text)' : 'var(--color-text)',
    borderColor: 'var(--color-border)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: 'var(--color-text)', minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--color-accent-soft, var(--color-surface-secondary))', color: 'var(--color-accent)', fontSize: 19 }}>♙</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 750, letterSpacing: '-0.5px' }}>Employee Management</h1>
          </div>
          <p style={{ margin: '7px 0 0 48px', color: 'var(--color-text-secondary)', fontSize: 13 }}>Manage accounts, department access and employee credentials.</p>
        </div>
        <button type="button" onClick={openCreateForm} style={{ ...buttonBase, padding: '11px 16px', background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)', boxShadow: '0 5px 14px rgba(139,92,246,0.2)' }}>
          + Add employee
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total employees', value: employees.length, mark: '◎' },
          { label: 'Active accounts', value: activeCount, mark: '✓' },
          { label: 'Inactive accounts', value: inactiveCount, mark: 'Ⅱ' },
        ].map((stat) => (
          <div key={stat.label} style={{ ...cardStyle, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--color-surface-secondary)', color: 'var(--color-accent)', fontSize: 18, fontWeight: 700 }}>{stat.mark}</div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{stat.label}</div>
              <div style={{ marginTop: 3, fontSize: 25, lineHeight: 1.1, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </section>

      {error && <div role="alert" style={{ padding: '12px 15px', borderRadius: 11, border: '1px solid var(--color-danger-text)', background: 'var(--color-danger-bg, var(--color-surface-secondary))', color: 'var(--color-danger-text)', fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: '12px 15px', borderRadius: 11, border: '1px solid var(--color-success-text)', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: 13 }}>{notice}</div>}

      {temporaryPassword && (
        <section style={{ ...cardStyle, padding: 18, borderColor: 'var(--color-success-text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 15 }}>Temporary password generated</strong>
              <p style={{ margin: '5px 0 12px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{passwordMessage} Employee ID: <strong>{passwordEmployeeId}</strong>. This password will not be shown again after you leave this page.</p>
            </div>
            <button type="button" onClick={() => { setTemporaryPassword(''); setPasswordEmployeeId(''); setPasswordMessage('') }} style={actionButton()}>Dismiss</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <code style={{ padding: '11px 14px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-surface-secondary)', color: 'var(--color-text)', fontSize: 14, userSelect: 'all' }}>{temporaryPassword}</code>
            <button type="button" onClick={copyTemporaryPassword} style={{ ...buttonBase, background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' }}>Copy password</button>
          </div>
        </section>
      )}

      <section style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ padding: 15, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 14 }}>Employee directory</strong>
            <div style={{ marginTop: 3, color: 'var(--color-text-secondary)', fontSize: 12 }}>Search and manage employee accounts</div>
          </div>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{filteredEmployees.length} of {employees.length} records</span>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) repeat(2, minmax(150px, 190px)) auto', gap: 9, borderBottom: '1px solid var(--color-border)' }}>
          <input aria-label="Search employees" placeholder="Search name, Employee ID or email..." value={search} onChange={(event) => setSearch(event.target.value)} style={inputBase} />
          <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} style={inputBase}>
            <option value="all">All departments</option>
            {activeDepartments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}
          </select>
          <select aria-label="Filter by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputBase}>
            <option value="active">Active accounts</option>
            <option value="inactive">Inactive accounts</option>
            <option value="all">All accounts</option>
          </select>
          <button type="button" onClick={() => void loadData()} disabled={loading} style={actionButton()}>{loading ? 'Loading…' : '↻ Refresh'}</button>
        </div>

        {loading ? (
          <div style={{ padding: 34, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading employee directory…</div>
        ) : filteredEmployees.length === 0 ? (
          <div style={{ padding: 42, textAlign: 'center' }}>
            <div style={{ fontSize: 25, color: 'var(--color-text-secondary)' }}>⌕</div>
            <strong style={{ display: 'block', marginTop: 8, fontSize: 14 }}>No employees found</strong>
            <span style={{ display: 'block', marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 12 }}>Try changing your search or filters.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-secondary)', color: 'var(--color-text-secondary)' }}>
                  {['Employee', 'Employee ID', 'Department', 'Role', 'Status', 'Actions'].map((heading) => <th key={heading} style={{ padding: '12px 15px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} style={{ borderTop: '1px solid var(--color-border)', opacity: employee.isActive ? 1 : 0.68 }}>
                    <td style={{ padding: '13px 15px', minWidth: 210 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, flex: '0 0 34px', display: 'grid', placeItems: 'center', borderRadius: 11, background: 'var(--color-surface-secondary)', color: 'var(--color-accent)', fontWeight: 750 }}>{employee.name.trim().charAt(0).toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650, color: 'var(--color-text)' }}>{employee.name}</div>
                          <div style={{ marginTop: 3, color: 'var(--color-text-secondary)', fontSize: 11 }}>{employee.email || 'No email added'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 15px', whiteSpace: 'nowrap' }}><code style={{ padding: '4px 7px', borderRadius: 6, background: 'var(--color-surface-secondary)', color: 'var(--color-text)' }}>{employee.employeeId}</code></td>
                    <td style={{ padding: '13px 15px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{getDepartmentName(employee.departmentId)}</td>
                    <td style={{ padding: '13px 15px', whiteSpace: 'nowrap' }}>{roleLabel(employee.role)}</td>
                    <td style={{ padding: '13px 15px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 20, background: employee.isActive ? 'var(--color-success-bg)' : 'var(--color-surface-secondary)', color: employee.isActive ? 'var(--color-success-text)' : 'var(--color-text-secondary)', fontSize: 11, fontWeight: 700 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 15px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => openEditForm(employee)} style={actionButton()}>Edit</button>
                        {employee.isActive && employee.id !== 1 && <button type="button" onClick={() => void handleResetPassword(employee)} style={actionButton()}>Reset password</button>}
                        {employee.isActive && <button type="button" onClick={() => void handleDeactivate(employee)} style={actionButton('danger')}>Deactivate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(5px)', overflowY: 'auto' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="employee-form-title" style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: 24, border: '1px solid var(--color-border)', borderRadius: 18, background: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, marginBottom: 22 }}>
              <div>
                <div style={{ color: 'var(--color-accent)', fontSize: 11, fontWeight: 750, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Employee account</div>
                <h2 id="employee-form-title" style={{ margin: '5px 0 0', fontSize: 21, fontWeight: 750 }}>{editingEmployee ? 'Edit employee' : 'Add new employee'}</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 12 }}>{editingEmployee ? 'Update account details and access.' : 'Employee ID and temporary password are generated automatically.'}</p>
              </div>
              <button type="button" aria-label="Close form" onClick={closeForm} style={{ ...actionButton(), width: 36, height: 36, padding: 0, fontSize: 17 }}>×</button>
            </div>

            <form onSubmit={handleSave}>
              {editingEmployee ? (
                <div style={{ marginBottom: 16, padding: '11px 13px', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface-secondary)' }}>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>Employee ID</div>
                  <code style={{ display: 'block', marginTop: 4, color: 'var(--color-text)', fontSize: 14 }}>{form.employeeId}</code>
                </div>
              ) : (
                <div style={{ marginBottom: 16, padding: '11px 13px', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface-secondary)', display: 'flex', gap: 9, alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-accent)', fontSize: 17 }}>✦</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>A unique sequential Employee ID will be assigned when you create this account.</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 15 }}>
                <label>
                  <span style={labelBase}>Full name <span style={{ color: 'var(--color-danger-text)' }}>*</span></span>
                  <input required maxLength={150} value={form.name} onChange={(event) => updateField('name', event.target.value)} style={inputBase} placeholder="Enter employee full name" />
                </label>
                <label>
                  <span style={labelBase}>Email address</span>
                  <input type="email" maxLength={255} value={form.email} onChange={(event) => updateField('email', event.target.value)} style={inputBase} placeholder="name@company.com" />
                </label>
                <label>
                  <span style={labelBase}>Role <span style={{ color: 'var(--color-danger-text)' }}>*</span></span>
                  <select required value={form.role} onChange={(event) => updateField('role', event.target.value as Role)} style={inputBase}>
                    <option value="employee">Employee</option>
                    <option value="department_head">Department Head</option>
                    <option value="master">Master</option>
                  </select>
                </label>
                <label>
                  <span style={labelBase}>Department {form.role !== 'master' && <span style={{ color: 'var(--color-danger-text)' }}>*</span>}</span>
                  <select value={form.departmentId} required={form.role !== 'master'} onChange={(event) => updateField('departmentId', event.target.value)} style={inputBase}>
                    <option value="">{form.role === 'master' ? 'No department' : 'Select department'}</option>
                    {activeDepartments.map((department) => <option key={department.id} value={String(department.id)}>{department.name} ({department.department_code})</option>)}
                  </select>
                </label>
              </div>

              {error && <p role="alert" style={{ margin: '15px 0 0', color: 'var(--color-danger-text)', fontSize: 12 }}>{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 24, paddingTop: 17, borderTop: '1px solid var(--color-border)' }}>
                <button type="button" disabled={saving} onClick={closeForm} style={actionButton()}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...buttonBase, minWidth: 135, background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)', opacity: saving ? 0.65 : 1 }}>{saving ? 'Saving…' : editingEmployee ? 'Save changes' : 'Create employee'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
