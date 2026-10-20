
import type { RowDataPacket } from 'mysql2'
import type { Request, Response } from 'express'
import { query, execute } from '../utils/db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import {
  loginSchema,
  changePasswordSchema,
} from '../validators/auth.validator.js'
import {
  createSessionToken,
  hashSessionToken,
  SESSION_DURATION_MS,
} from '../utils/session.js'

interface UserRow extends RowDataPacket {
  id: number
  employee_id: string
  email: string | null
  full_name: string
  password_hash: string
  role: 'master' | 'department_head' | 'employee'
  department_id: number | null
  is_active: number | boolean
  must_change_password: number | boolean
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid Employee ID or email and password.',
    })
  }

  try {
    const { identifier, password } = parsed.data

    const users = await query<UserRow>(
      `SELECT id, employee_id, email, full_name, password_hash,
              role, department_id, is_active, must_change_password
       FROM users
       WHERE employee_id = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier],
    )

    const user = users[0]

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      })
    }

    const passwordMatches = await verifyPassword(
      user.password_hash,
      password,
    )

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      })
    }

    const token = createSessionToken()
    const tokenHash = hashSessionToken(token)
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await execute(
      `INSERT INTO user_sessions (user_id, session_token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt],
    )

    res.cookie('helpdesk_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    })

    return res.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        employeeId: user.employee_id,
        name: user.full_name,
        role: user.role,
        departmentId: user.department_id,
        mustChangePassword: Boolean(user.must_change_password),
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred.',
    })
  }
}

export async function changePassword(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message:
        'Please provide your current password and a valid new password.',
    })
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    })
  }

  try {
    const { currentPassword, newPassword } = parsed.data

    const users = await query<UserRow>(
      `SELECT id, employee_id, email, full_name, password_hash,
              role, department_id, is_active, must_change_password
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id],
    )

    const user = users[0]

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or inactive.',
      })
    }

    const passwordMatches = await verifyPassword(
      user.password_hash,
      currentPassword,
    )

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      })
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Your new password must differ from your current password.',
      })
    }

    const newPasswordHash = await hashPassword(newPassword)

    await execute(
      `UPDATE users
       SET password_hash = ?, must_change_password = FALSE
       WHERE id = ?`,
      [newPasswordHash, user.id],
    )

    // Invalidate all existing sessions after a password change.
    await execute(
      'DELETE FROM user_sessions WHERE user_id = ?',
      [user.id],
    )

    res.clearCookie('helpdesk_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    })
  } catch (error) {
    console.error('Change password error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to change password. Please try again.',
    })
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.helpdesk_session

  try {
    if (typeof token === 'string' && token.length === 64) {
      await execute(
        'DELETE FROM user_sessions WHERE session_token_hash = ?',
        [hashSessionToken(token)],
      )
    }

    res.clearCookie('helpdesk_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return res.json({
      success: true,
      message: 'Logged out successfully.',
    })
  } catch (error) {
    console.error('Logout error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to log out. Please try again.',
    })
  }
}

export function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    })
  }

  return res.json({
    success: true,
    user: req.user,
  })
}
