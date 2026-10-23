import type { Request, Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomBytes } from 'node:crypto'
import { pool } from '../config/database.js'
import { createTicketSchema } from '../validators/ticket.validator.js'

interface DepartmentRow extends RowDataPacket {
  id: number
  name: string
  departmentCode: string
}

interface TicketRow extends RowDataPacket {
  id: number
  ticketCode: string
  title: string
  description: string
  status: string
  departmentId: number
  departmentName: string
  requesterUserId: number
  requesterName: string
  assignedEmployeeId: number | null
  createdAt: Date
  updatedAt: Date
}

export async function getDepartments(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [departments] = await pool.query<DepartmentRow[]>(`
      SELECT
        id,
        name,
        department_code AS departmentCode
      FROM departments
      WHERE is_active = 1
      ORDER BY name ASC
    `)

    res.status(200).json({ success: true, departments })
  } catch (error) {
    console.error('Get departments error:', error)
    res.status(500).json({ success: false, message: 'Unable to load departments.' })
  }
}

export async function createTicket(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const validation = createTicketSchema.safeParse(req.body)
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: validation.error.issues[0]?.message ?? 'Invalid ticket details.',
      })
      return
    }

    const { title, description, departmentId } = validation.data
    const user = req.user
    if (!user) {
      res.status(401).json({ success: false, message: 'Please log in to create a ticket.' })
      return
    }

    const [departments] = await pool.execute<DepartmentRow[]>(
      `SELECT id, name, department_code AS departmentCode
       FROM departments WHERE id = ? AND is_active = 1 LIMIT 1`,
      [departmentId],
    )
    if (departments.length === 0) {
      res.status(400).json({ success: false, message: 'Please select an active department.' })
      return
    }

    const ticketCode = `HD-${randomBytes(6).toString('hex').toUpperCase()}`
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO tickets
        (ticket_code, title, description, requester_user_id, department_id, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [ticketCode, title, description, user.id, departmentId],
    )

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      ticket: {
        id: result.insertId,
        ticketCode,
        title,
        description,
        status: 'open',
        departmentId,
        departmentName: departments[0].name,
        requesterUserId: user.id,
      },
    })
  } catch (error) {
    console.error('Create ticket error:', error)
    res.status(500).json({ success: false, message: 'Unable to create the ticket. Please try again.' })
  }
}

export async function getTickets(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ success: false, message: 'Please log in to view tickets.' })
      return
    }

    let sql = `
      SELECT
        t.id,
        t.ticket_code AS ticketCode,
        t.title,
        t.description,
        t.status,
        t.department_id AS departmentId,
        d.name AS departmentName,
        t.requester_user_id AS requesterUserId,
        u.full_name AS requesterName,
        t.assigned_employee_id AS assignedEmployeeId,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tickets t
      INNER JOIN departments d ON d.id = t.department_id
      INNER JOIN users u ON u.id = t.requester_user_id
    `

    const params: (string | number)[] = []
    if (user.role === 'master') {
      // Master users can view all tickets.
    } else if (user.role === 'department_head') {
      sql += ' WHERE d.head_user_id = ?'
      params.push(user.id)
    } else {
      sql += ' WHERE t.requester_user_id = ?'
      params.push(user.id)
    }

    sql += ' ORDER BY t.created_at DESC'
    const [tickets] = await pool.execute<TicketRow[]>(sql, params)
    res.status(200).json({ success: true, tickets })
  } catch (error) {
    console.error('Get tickets error:', error)
    res.status(500).json({ success: false, message: 'Unable to load tickets.' })
  }
}

export async function assignTicket(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ success: false, message: 'Please log in to assign tickets.' })
      return
    }

    if (user.role !== 'master') {
      res.status(403).json({ success: false, message: 'Only the master user can assign tickets.' })
      return
    }

    const ticketId = Number(req.params.id)
    const employeeId = Number(req.body.employeeId)
    if (
      !Number.isSafeInteger(ticketId) || ticketId <= 0 ||
      !Number.isSafeInteger(employeeId) || employeeId <= 0
    ) {
      res.status(400).json({ success: false, message: 'A valid ticket ID and employee ID are required.' })
      return
    }

    const [tickets] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM tickets WHERE id = ? LIMIT 1',
      [ticketId],
    )
    if (tickets.length === 0) {
      res.status(404).json({ success: false, message: 'Ticket not found.' })
      return
    }

    // Cross-department assignment is allowed. Only active employees and department heads may be assigned.
    const [employees] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM users
       WHERE id = ? AND is_active = 1
         AND role IN ('employee', 'department_head')
       LIMIT 1`,
      [employeeId],
    )
    if (employees.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Select an active employee or department head.',
      })
      return
    }

    await pool.execute(
      `UPDATE tickets
       SET assigned_employee_id = ?, status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END
       WHERE id = ?`,
      [employeeId, ticketId],
    )

    res.status(200).json({ success: true, message: 'Ticket assigned successfully.' })
  } catch (error) {
    console.error('Assign ticket error:', error)
    res.status(500).json({ success: false, message: 'Unable to assign the ticket. Please try again.' })
  }
}
