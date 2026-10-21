
import { Router } from 'express'
import { query } from '../utils/db.js'
import type { RowDataPacket } from 'mysql2'

const router = Router()

interface DepartmentRow extends RowDataPacket {
  id: number
  name: string
  department_code: string
  is_active: number | boolean
  head_user_id: number | null
}

router.get('/', async (_req, res) => {
  try {
    const departments = await query<DepartmentRow>(
      `SELECT id, name, department_code, is_active, head_user_id
       FROM departments
       ORDER BY name ASC`,
    )

    res.json({
      success: true,
      departments,
    })
  } catch (error) {
    console.error('Failed to fetch departments:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
    })
  }
})

export default router
