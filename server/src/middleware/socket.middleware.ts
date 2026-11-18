
import type { Socket } from 'socket.io'
import type { RowDataPacket } from 'mysql2'
import { parse } from 'node:querystring'
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

export interface SocketUser {
  id: number
  employeeId: string
  name: string
  role: 'master' | 'department_head' | 'employee'
  departmentId: number | null
  departmentName: string | null
  mustChangePassword: boolean
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser
  }
}

export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie

    if (!cookieHeader) {
      return next(new Error('Authentication required.'))
    }

    const cookies = parse(
      cookieHeader.split(';').join('&'),
    )

    const token = cookies.helpdesk_session

    if (typeof token !== 'string' || token.length !== 64) {
      return next(new Error('Invalid session.'))
    }

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
      return next(new Error('Session invalid or expired.'))
    }

    socket.data.user = {
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
    console.error('Socket authentication error:', error)
    return next(new Error('Unable to authenticate socket connection.'))
  }
}
