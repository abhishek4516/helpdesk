import { query } from '../utils/db.js'
import { verifyPassword } from '../utils/password.js'
import type { RowDataPacket } from 'mysql2'
import 'dotenv/config'
import { pool } from '../config/database.js'

interface MasterRow extends RowDataPacket {
  password_hash: string
}

async function main() {
  try {
    const rows = await query<MasterRow>(
      `SELECT password_hash
       FROM users
       WHERE employee_id = ?
       LIMIT 1`,
      ['100001'],
    )

    if (!rows[0]) {
      console.log('Master account not found.')
      return
    }

    const password = process.env.MASTER_TEMP_PASSWORD

    if (!password) {
      console.log('MASTER_TEMP_PASSWORD is missing from .env')
      return
    }

    const matches = await verifyPassword(
      rows[0].password_hash,
      password,
    )

    console.log('Temporary password matches database:', matches)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Password check failed:', error.message)
  process.exitCode = 1
})