
import { randomInt } from 'node:crypto'
import type { Request, Response } from 'express'
import type { RowDataPacket } from 'mysql2'
import { query, execute } from '../utils/db.js'
import { hashPassword } from '../utils/password.js'
import { createSessionToken, hashSessionToken } from '../utils/session.js'

type UserRole = 'master' | 'department_head' | 'employee'

interface EmployeeRow extends RowDataPacket {
  id: number
  employee_id: string
  full_name: string
  email: string | null
  role: UserRole
  department_id: number | null
  is_active: number | boolean
  must_change_password: number | boolean
}

interface DepartmentRow extends RowDataPacket {
  id: number
  is_active: number | boolean
}

const temporaryPasswordAlphabet =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'

function generateTemporaryPassword(): string {
  return Array.from({ length: 16 }, () =>
    temporaryPasswordAlphabet[
      randomInt(temporaryPasswordAlphabet.length)
    ],
  ).join('')
}

function parsePositiveId(value: unknown): number | null {
  const id = Number(value)

  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseRole(value: unknown): UserRole | null {
  if (
    value === 'master' ||
    value === 'department_head' ||
    value === 'employee'
  ) {
    return value
  }

  return null
}

function parseDepartmentId(value: unknown): number | null | undefined {
  if (value === null || value === '') return null

  if (value === undefined) return undefined

  return parsePositiveId(value) ?? undefined
}

function publicEmployee(employee: EmployeeRow) {
  return {
    id: employee.id,
    employeeId: employee.employee_id,
    name: employee.full_name,
    email: employee.email,
    role: employee.role,
    departmentId: employee.department_id,
    isActive: Boolean(employee.is_active),
    mustChangePassword: Boolean(employee.must_change_password),
  }
}

async function departmentExists(departmentId: number): Promise<boolean> {
  const departments = await query<DepartmentRow>(
    `SELECT id, is_active
     FROM departments
     WHERE id = ? AND is_active = TRUE
     LIMIT 1`,
    [departmentId],
  )

  return departments.length > 0
}

async function invalidateSessions(userId: number): Promise<void> {
  await execute('DELETE FROM user_sessions WHERE user_id = ?', [userId])
}

export async function listEmployees(_req: Request, res: Response) {
  try {
    const employees = await query<EmployeeRow>(
      `SELECT id, employee_id, full_name, email, role,
              department_id, is_active, must_change_password
       FROM users
       ORDER BY full_name ASC`,
    )

    return res.json({
      success: true,
      employees: employees.map(publicEmployee),
    })
  } catch (error) {
    console.error('List employees error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to load employees.',
    })
  }
}

export async function createEmployee(req: Request, res: Response) {
  const employeeId =
    typeof req.body.employeeId === 'string'
      ? req.body.employeeId.trim()
      : ''

  const name =
    typeof req.body.name === 'string' ? req.body.name.trim() : ''

  const email =
    typeof req.body.email === 'string' && req.body.email.trim()
      ? req.body.email.trim().toLowerCase()
      : null

  const role = parseRole(req.body.role)
  const departmentId = parseDepartmentId(req.body.departmentId)

  if (!/^\d{1,20}$/.test(employeeId)) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID must contain 1 to 20 digits.',
    })
  }

  if (!name || name.length > 150) {
    return res.status(400).json({
      success: false,
      message: 'Name is required and must not exceed 150 characters.',
    })
  }

  if (
    email !== null &&
    (email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    })
  }

  if (!role) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid role.',
    })
  }

  if (departmentId === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid department.',
    })
  }

  if (role !== 'master' && departmentId === null) {
    return res.status(400).json({
      success: false,
      message: 'A department is required for this role.',
    })
  }

  if (departmentId !== null && !(await departmentExists(departmentId))) {
    return res.status(400).json({
      success: false,
      message: 'The selected department does not exist or is inactive.',
    })
  }

  try {
    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    const result = await execute(
      `INSERT INTO users
        (employee_id, full_name, email, password_hash, role,
         department_id, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
      [employeeId, name, email, passwordHash, role, departmentId],
    )

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      employee: {
        id: result.insertId,
        employeeId,
        name,
        email,
        role,
        departmentId,
        isActive: true,
        mustChangePassword: true,
      },
      temporaryPassword,
    })
  } catch (error) {
    const dbError = error as { code?: string }

    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'That Employee ID or email address is already in use.',
      })
    }

    console.error('Create employee error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to create employee.',
    })
  }
}

export async function updateEmployee(req: Request, res: Response) {
  const employeeDatabaseId = parsePositiveId(req.params.id)

  if (!employeeDatabaseId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid employee record ID.',
    })
  }

  const employeeId =
    typeof req.body.employeeId === 'string'
      ? req.body.employeeId.trim()
      : ''

  const name =
    typeof req.body.name === 'string' ? req.body.name.trim() : ''

  const email =
    typeof req.body.email === 'string' && req.body.email.trim()
      ? req.body.email.trim().toLowerCase()
      : null

  const role = parseRole(req.body.role)
  const departmentId = parseDepartmentId(req.body.departmentId)

  if (!/^\d{1,20}$/.test(employeeId)) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID must contain 1 to 20 digits.',
    })
  }

  if (!name || name.length > 150) {
    return res.status(400).json({
      success: false,
      message: 'Name is required and must not exceed 150 characters.',
    })
  }

  if (
    email !== null &&
    (email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    })
  }

  if (!role) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid role.',
    })
  }

  if (departmentId === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid department.',
    })
  }

  if (role !== 'master' && departmentId === null) {
    return res.status(400).json({
      success: false,
      message: 'A department is required for this role.',
    })
  }

  try {
    if (departmentId !== null && !(await departmentExists(departmentId))) {
      return res.status(400).json({
        success: false,
        message: 'The selected department does not exist or is inactive.',
      })
    }

    const existing = await query<EmployeeRow>(
      `SELECT id, employee_id, full_name, email, role,
              department_id, is_active, must_change_password
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [employeeDatabaseId],
    )

    if (!existing[0]) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      })
    }

    if (existing[0].id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot edit your own account here.',
      })
    }

    await execute(
      `UPDATE users
       SET employee_id = ?, full_name = ?, email = ?,
           role = ?, department_id = ?
       WHERE id = ?`,
      [employeeId, name, email, role, departmentId, employeeDatabaseId],
    )

    await invalidateSessions(employeeDatabaseId)

    const updated = await query<EmployeeRow>(
      `SELECT id, employee_id, full_name, email, role,
              department_id, is_active, must_change_password
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [employeeDatabaseId],
    )

    return res.json({
      success: true,
      message: 'Employee details updated. They must log in again.',
      employee: publicEmployee(updated[0]),
    })
  } catch (error) {
    const dbError = error as { code?: string }

    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'That Employee ID or email address is already in use.',
      })
    }

    console.error('Update employee error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update employee.',
    })
  }
}

export async function deactivateEmployee(req: Request, res: Response) {
  const employeeDatabaseId = parsePositiveId(req.params.id)

  if (!employeeDatabaseId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid employee record ID.',
    })
  }

  if (employeeDatabaseId === req.user?.id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot deactivate your own account.',
    })
  }

  try {
    const result = await execute(
      'UPDATE users SET is_active = FALSE WHERE id = ? AND is_active = TRUE',
      [employeeDatabaseId],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active employee not found.',
      })
    }

    await invalidateSessions(employeeDatabaseId)

    return res.json({
      success: true,
      message: 'Employee account deactivated. Ticket history is preserved.',
    })
  } catch (error) {
    console.error('Deactivate employee error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to deactivate employee.',
    })
  }
}

export async function resetEmployeePassword(req: Request, res: Response) {
  const employeeDatabaseId = parsePositiveId(req.params.id)

  if (!employeeDatabaseId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid employee record ID.',
    })
  }

  if (employeeDatabaseId === req.user?.id) {
    return res.status(400).json({
      success: false,
      message: 'Use the regular password-change process for your own account.',
    })
  }

  try {
    const employees = await query<EmployeeRow>(
      `SELECT id, employee_id, full_name, email, role,
              department_id, is_active, must_change_password
       FROM users
       WHERE id = ? AND is_active = TRUE
       LIMIT 1`,
      [employeeDatabaseId],
    )

    if (!employees[0]) {
      return res.status(404).json({
        success: false,
        message: 'Active employee not found.',
      })
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    await execute(
      `UPDATE users
       SET password_hash = ?, must_change_password = TRUE
       WHERE id = ?`,
      [passwordHash, employeeDatabaseId],
    )

    await invalidateSessions(employeeDatabaseId)

    return res.json({
      success: true,
      message: 'Temporary password generated. The employee must change it at next login.',
      employeeId: employees[0].employee_id,
      temporaryPassword,
    })
  } catch (error) {
    console.error('Reset employee password error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to reset employee password.',
    })
  }
}
