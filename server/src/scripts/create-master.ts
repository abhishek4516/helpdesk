
import dotenv from 'dotenv'
import { hashPassword } from '../utils/password.js'
import { execute, query } from '../utils/db.js'
import type { RowDataPacket } from 'mysql2'
dotenv.config()

async function createMaster() {
  const employeeId = process.env.MASTER_EMPLOYEE_ID
  const fullName = process.env.MASTER_FULL_NAME
  const email = process.env.MASTER_EMAIL
  const password = process.env.MASTER_TEMP_PASSWORD

  if (!employeeId || !fullName || !password) {
    throw new Error(
      'Set MASTER_EMPLOYEE_ID, MASTER_FULL_NAME, and MASTER_TEMP_PASSWORD in your local environment.',
    )
  }

  const existing = await query<RowDataPacket & { id: number }>(
    `SELECT id FROM users WHERE employee_id = ? OR (? IS NOT NULL AND email = ?) LIMIT 1`,
    [employeeId, email ?? null, email ?? null],
  )

  if (existing.length > 0) {
    throw new Error('An account with that Employee ID or email already exists.')
  }

  const passwordHash = await hashPassword(password)

  await execute(
    `INSERT INTO users
      (employee_id, full_name, email, password_hash, role,
       department_id, is_active, must_change_password)
     VALUES (?, ?, ?, ?, 'master', NULL, TRUE, TRUE)`,
    [employeeId, fullName, email ?? null, passwordHash],
  )

  console.log('Master account created. Change its temporary password at first login.')
}

createMaster().catch((error) => {
  console.error('Master account setup failed:', error.message)
  process.exitCode = 1
})
