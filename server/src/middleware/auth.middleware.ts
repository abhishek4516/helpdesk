
import type { Request, Response, NextFunction } from 'express'
import type { RowDataPacket } from 'mysql2'
import { query } from '../utils/db.js'
import { hashSessionToken } from '../utils/session.js'

interface SessionUser extends RowDataPacket {
  id: number
  employee_id: string
  full_name: string
  role: 'master' | 'department_head' | 'employee'
  department_id: number | null
  department_name: string | null
  is_active: number | boolean
  must_change_password: number | boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        employeeId: string
        name: string
        role: 'master' | 'department_head' | 'employee'
        departmentId: number | null
        departmentName: string | null
        mustChangePassword: boolean
      }
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.helpdesk_session

  if (typeof token !== 'string' || token.length !== 64) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    })
  }

  try {
    const users = await query<SessionUser>(
      `SELECT
          u.id,
          u.employee_id,
          u.full_name,
          u.role,
          u.department_id,
          d.name AS department_name,
          u.is_active,
          u.must_change_password
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE s.session_token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [hashSessionToken(token)],
    )

    const user = users[0]

    if (!user || !user.is_active) {
      res.clearCookie('helpdesk_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })

      return res.status(401).json({
        success: false,
        message: 'Your session is invalid or expired. Please log in again.',
      })
    }

    req.user = {
      id: user.id,
      employeeId: user.employee_id,
      name: user.full_name,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
      mustChangePassword: Boolean(user.must_change_password),
    }

    return next()
  } catch (error) {
    console.error('Session verification error:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to verify your session.',
    })
  }
}
