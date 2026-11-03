
import type { Request, Response } from 'express'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { query, execute, withTransaction } from '../utils/db.js'

interface DepartmentRow extends RowDataPacket {
  id: number
  name: string
  department_code: string
  head_user_id: number | null
  is_active: number | boolean
}

interface HeadRow extends RowDataPacket {
  id: number
  full_name: string
  role: 'master' | 'department_head' | 'employee'
  department_id: number | null
  is_active: number | boolean
}

function parseId(value: unknown): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseDepartmentInput(body: Record<string, unknown>) {
  const name =
    typeof body.name === 'string' ? body.name.trim() : ''

  const departmentCode =
    typeof body.department_code === 'string'
      ? body.department_code.trim().toUpperCase()
      : ''

  if (!name || name.length > 100) {
    return { error: 'Department name is required and must not exceed 100 characters.' }
  }

  if (!/^[A-Z0-9_-]{1,30}$/.test(departmentCode)) {
    return { error: 'Department code must contain 1 to 30 letters, numbers, underscores or hyphens.' }
  }

  return { name, departmentCode }
}

export async function listDepartments(_req: Request, res: Response) {
  try {
    const departments = await query<DepartmentRow>(
      `SELECT
         d.id,
         d.name,
         d.department_code,
         d.head_user_id,
         d.is_active,
         u.full_name AS head_name
       FROM departments d
       LEFT JOIN users u ON u.id = d.head_user_id
       ORDER BY d.name ASC`,
    )

    return res.json({
      success: true,
      departments,
    })
  } catch (error) {
    console.error('List departments error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to load departments.',
    })
  }
}

export async function createDepartment(req: Request, res: Response) {
  const input = parseDepartmentInput(req.body)

  if ('error' in input) {
    return res.status(400).json({
      success: false,
      message: input.error,
    })
  }

  try {
    const result = await execute(
      `INSERT INTO departments (name, department_code)
       VALUES (?, ?)`,
      [input.name, input.departmentCode],
    )

    return res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      department: {
        id: result.insertId,
        name: input.name,
        department_code: input.departmentCode,
        head_user_id: null,
        is_active: true,
      },
    })
  } catch (error) {
    const dbError = error as { code?: string }

    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A department with that name or code already exists.',
      })
    }

    console.error('Create department error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to create department.',
    })
  }
}

export async function updateDepartment(req: Request, res: Response) {
  const departmentId = parseId(req.params.id)

  if (!departmentId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid department ID.',
    })
  }

  const input = parseDepartmentInput(req.body)

  if ('error' in input) {
    return res.status(400).json({
      success: false,
      message: input.error,
    })
  }

  try {
    const result = await execute(
      `UPDATE departments
       SET name = ?, department_code = ?
       WHERE id = ?`,
      [input.name, input.departmentCode, departmentId],
    )

    if (result.affectedRows === 0) {
      const existing = await query<DepartmentRow>(
        'SELECT id FROM departments WHERE id = ?',
        [departmentId],
      )

      if (!existing.length) {
        return res.status(404).json({
          success: false,
          message: 'Department not found.',
        })
      }
    }

    return res.json({
      success: true,
      message: 'Department updated successfully.',
    })
  } catch (error) {
    const dbError = error as { code?: string }

    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A department with that name or code already exists.',
      })
    }

    console.error('Update department error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update department.',
    })
  }
}

export async function assignDepartmentHead(req: Request, res: Response) {
  const departmentId = parseId(req.params.id)
  const headUserId = parseId(req.body.head_user_id)

  if (!departmentId || !headUserId) {
    return res.status(400).json({
      success: false,
      message: 'Valid department ID and head user ID are required.',
    })
  }

  try {
    await withTransaction(async (connection) => {
      const [departments] = await connection.query<DepartmentRow[]>(
        `SELECT id, name, department_code, head_user_id, is_active
         FROM departments
         WHERE id = ?
         FOR UPDATE`,
        [departmentId],
      )

      if (!departments[0] || !departments[0].is_active) {
        throw new Error('DEPARTMENT_NOT_FOUND')
      }

      const [users] = await connection.query<HeadRow[]>(
        `SELECT id, full_name, role, department_id, is_active
         FROM users
         WHERE id = ?
         FOR UPDATE`,
        [headUserId],
      )

      const head = users[0]

      if (!head || !head.is_active) {
        throw new Error('HEAD_NOT_ACTIVE')
      }

      if (
        head.role !== 'department_head' ||
        head.department_id !== departmentId
      ) {
        throw new Error('INVALID_HEAD')
      }

      const [otherDepartments] = await connection.query<DepartmentRow[]>(
        `SELECT id
         FROM departments
         WHERE head_user_id = ? AND id <> ?
         LIMIT 1`,
        [headUserId, departmentId],
      )

      if (otherDepartments.length > 0) {
        throw new Error('HEAD_ALREADY_ASSIGNED')
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE departments
         SET head_user_id = ?
         WHERE id = ?`,
        [headUserId, departmentId],
      )
    })

    return res.json({
      success: true,
      message: 'Department head assigned successfully.',
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''

    const messages: Record<string, { status: number; message: string }> = {
      DEPARTMENT_NOT_FOUND: {
        status: 404,
        message: 'Active department not found.',
      },
      HEAD_NOT_ACTIVE: {
        status: 400,
        message: 'The selected department head is not active.',
      },
      INVALID_HEAD: {
        status: 400,
        message: 'The selected user must be an active department head belonging to this department.',
      },
      HEAD_ALREADY_ASSIGNED: {
        status: 409,
        message: 'This user is already assigned as another department head.',
      },
    }

    if (messages[code]) {
      return res.status(messages[code].status).json({
        success: false,
        message: messages[code].message,
      })
    }

    console.error('Assign department head error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to assign department head.',
    })
  }
}

export async function removeDepartmentHead(req: Request, res: Response) {
  const departmentId = parseId(req.params.id)

  if (!departmentId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid department ID.',
    })
  }

  try {
    const result = await execute(
      `UPDATE departments
       SET head_user_id = NULL
       WHERE id = ? AND head_user_id IS NOT NULL`,
      [departmentId],
    )

    if (result.affectedRows === 0) {
      const departments = await query<DepartmentRow>(
        'SELECT id FROM departments WHERE id = ?',
        [departmentId],
      )

      if (!departments.length) {
        return res.status(404).json({
          success: false,
          message: 'Department not found.',
        })
      }
    }

    return res.json({
      success: true,
      message: 'Department head removed successfully.',
    })
  } catch (error) {
    console.error('Remove department head error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to remove department head.',
    })
  }
}

export async function setDepartmentActiveStatus(req: Request, res: Response) {
  const departmentId = parseId(req.params.id)
  const isActive = req.body.is_active

  if (!departmentId || typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'A valid department ID and active status are required.',
    })
  }

  try {
    const result = await execute(
      `UPDATE departments
       SET is_active = ?
       WHERE id = ?`,
      [isActive, departmentId],
    )

    if (result.affectedRows === 0) {
      const departments = await query<DepartmentRow>(
        'SELECT id FROM departments WHERE id = ?',
        [departmentId],
      )

      if (!departments.length) {
        return res.status(404).json({
          success: false,
          message: 'Department not found.',
        })
      }
    }

    return res.json({
      success: true,
      message: `Department ${isActive ? 'activated' : 'deactivated'} successfully.`,
    })
  } catch (error) {
    console.error('Update department status error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to update department status.',
    })
  }
}
