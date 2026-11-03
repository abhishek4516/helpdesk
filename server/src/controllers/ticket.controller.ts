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
 VALUES (?, ?, ?, ?, ?, 'pending_approval')`,
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
        status: 'pending approval',
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
  // Department heads can view all tickets in their department.
  sql += ' WHERE d.head_user_id = ?'
  params.push(user.id)
} else {
  // Employees can view tickets they created or tickets assigned to them.
  sql += ' WHERE (t.requester_user_id = ? OR t.assigned_employee_id = ?)'
  params.push(user.id, user.id)
}
    sql += ' ORDER BY t.created_at DESC'
    const [tickets] = await pool.execute<TicketRow[]>(sql, params)
    res.status(200).json({ success: true, tickets })
  } catch (error) {
    console.error('Get tickets error:', error)
    res.status(500).json({ success: false, message: 'Unable to load tickets.' })
  }
}
export async function reviewTicket(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to review tickets.',
      })
      return
    }

    if (user.role !== 'department_head') {
      res.status(403).json({
        success: false,
        message: 'Only department heads can review tickets.',
      })
      return
    }

    const ticketId = Number(req.params.id)
    const { action, reason } = req.body as {
      action?: string
      reason?: string
    }

    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({
        success: false,
        message: 'A valid ticket ID is required.',
      })
      return
    }

    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({
        success: false,
        message: 'Action must be approve or reject.',
      })
      return
    }

    if (
      action === 'reject' &&
      (typeof reason !== 'string' || !reason.trim())
    ) {
      res.status(400).json({
        success: false,
        message: 'Please provide a reason for rejection.',
      })
      return
    }

    const [tickets] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.status
       FROM tickets t
       INNER JOIN departments d ON d.id = t.department_id
       WHERE t.id = ?
         AND d.head_user_id = ?
       LIMIT 1`,
      [ticketId, user.id],
    )

    if (tickets.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found in your department.',
      })
      return
    }

    if (tickets[0].status !== 'pending_approval') {
      res.status(409).json({
        success: false,
        message: 'This ticket is no longer awaiting approval.',
      })
      return
    }

    if (action === 'approve') {
      await pool.execute(
        `UPDATE tickets
         SET status = 'approved',
             approved_by_user_id = ?,
             approved_at = CURRENT_TIMESTAMP,
             rejection_reason = NULL
         WHERE id = ? AND status = 'pending_approval'`,
        [user.id, ticketId],
      )
    } else {
      await pool.execute(
        `UPDATE tickets
         SET status = 'rejected',
             approved_by_user_id = ?,
             approved_at = CURRENT_TIMESTAMP,
             rejection_reason = ?
         WHERE id = ? AND status = 'pending_approval'`,
        [user.id, reason!.trim(), ticketId],
      )
    }

    res.status(200).json({
      success: true,
      message:
        action === 'approve'
          ? 'Ticket approved successfully.'
          : 'Ticket rejected successfully.',
    })
  } catch (error) {
    console.error('Review ticket error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to review the ticket. Please try again.',
    })
  }
}
export async function assignTicket(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to assign tickets.',
      })
      return
    }

    if (user.role !== 'master' && user.role !== 'department_head') {
      res.status(403).json({
        success: false,
        message: 'Only master users or department heads can assign tickets.',
      })
      return
    }

    const ticketId = Number(req.params.id)
    const employeeId = Number(req.body.employeeId)

    if (
      !Number.isSafeInteger(ticketId) || ticketId <= 0 ||
      !Number.isSafeInteger(employeeId) || employeeId <= 0
    ) {
      res.status(400).json({
        success: false,
        message: 'A valid ticket ID and employee ID are required.',
      })
      return
    }

    const [tickets] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.department_id AS departmentId, t.status
       FROM tickets t
       INNER JOIN departments d ON d.id = t.department_id
       WHERE t.id = ?
         AND (? = 'master' OR d.head_user_id = ?)
       LIMIT 1`,
      [ticketId, user.role, user.id],
    )

    if (tickets.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found in your accessible departments.',
      })
      return
    }

    const ticket = tickets[0]

    if (ticket.status !== 'approved') {
      res.status(409).json({
        success: false,
        message: 'Only approved tickets can be assigned.',
      })
      return
    }

    const employeeSql =
      user.role === 'department_head'
        ? `SELECT id FROM users
           WHERE id = ?
             AND department_id = ?
             AND is_active = 1
             AND role = 'employee'
           LIMIT 1`
        : `SELECT id FROM users
           WHERE id = ?
             AND is_active = 1
             AND role IN ('employee', 'department_head')
           LIMIT 1`

    const employeeParams =
      user.role === 'department_head'
        ? [employeeId, ticket.departmentId]
        : [employeeId]

    const [employees] = await pool.execute<RowDataPacket[]>(
      employeeSql,
      employeeParams,
    )

    if (employees.length === 0) {
      res.status(400).json({
        success: false,
        message:
          user.role === 'department_head'
            ? 'Select an active employee from your department.'
            : 'Select an active employee or department head.',
      })
      return
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tickets
       SET assigned_employee_id = ?,
           status = 'assigned'
       WHERE id = ?
         AND status = 'approved'
         AND assigned_employee_id IS NULL`,
      [employeeId, ticketId],
    )

    if (result.affectedRows === 0) {
      res.status(409).json({
        success: false,
        message: 'This ticket has already been assigned or its status changed.',
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully.',
    })
  } catch (error) {
    console.error('Assign ticket error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to assign the ticket. Please try again.',
    })
  }
}

export async function getTicketLifecycle(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to view the ticket lifecycle.',
      })
      return
    }

    const ticketId = Number(req.params.id)

    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({
        success: false,
        message: 'A valid ticket ID is required.',
      })
      return
    }

    // Fetch the ticket and its creator.
    const [tickets] = await pool.execute<RowDataPacket[]>(
      `SELECT
         t.id,
         t.ticket_code AS ticketCode,
         t.title,
         t.description,
         t.status,
         t.created_at AS createdAt,
         t.updated_at AS updatedAt,
         t.requester_user_id AS requesterUserId,
         creator.full_name AS requesterName,
         creator.role AS requesterRole,
         t.department_id AS departmentId,
         d.name AS departmentName,
         t.assigned_employee_id AS assignedEmployeeId,
         assignee.full_name AS assignedEmployeeName
       FROM tickets t
       INNER JOIN users creator ON creator.id = t.requester_user_id
       INNER JOIN departments d ON d.id = t.department_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_employee_id
       WHERE t.id = ?
       LIMIT 1`,
      [ticketId],
    )

    if (tickets.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      })
      return
    }

    const ticket = tickets[0]

    // Apply the same basic visibility rules as getTickets.
    if (user.role === 'department_head') {
      const [visible] = await pool.execute<RowDataPacket[]>(
        `SELECT id
         FROM departments
         WHERE id = ? AND head_user_id = ?
         LIMIT 1`,
        [ticket.departmentId, user.id],
      )

      if (visible.length === 0) {
        res.status(403).json({
          success: false,
          message: 'You cannot view this ticket lifecycle.',
        })
        return
      }
    } else if (
      user.role !== 'master' &&
      ticket.requesterUserId !== user.id &&
      ticket.assignedEmployeeId !== user.id
    ) {
      res.status(403).json({
        success: false,
        message: 'You cannot view this ticket lifecycle.',
      })
      return
    }

    // Fetch all transfer requests and their review details.
    const [transfers] = await pool.execute<RowDataPacket[]>(
      `SELECT
         tr.id,
         tr.requested_by_user_id AS requestedByUserId,
         requester.full_name AS requestedByName,
         tr.from_department_id AS fromDepartmentId,
         source.name AS fromDepartmentName,
         tr.to_department_id AS toDepartmentId,
         destination.name AS toDepartmentName,
         tr.reason,
         tr.status,
         tr.reviewed_by_user_id AS reviewedByUserId,
         reviewer.full_name AS reviewedByName,
         tr.review_comment AS reviewComment,
         tr.created_at AS createdAt,
         tr.reviewed_at AS reviewedAt
       FROM ticket_transfer_requests tr
       INNER JOIN users requester ON requester.id = tr.requested_by_user_id
       INNER JOIN departments source ON source.id = tr.from_department_id
       INNER JOIN departments destination ON destination.id = tr.to_department_id
       LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by_user_id
       WHERE tr.ticket_id = ?
       ORDER BY tr.created_at ASC, tr.id ASC`,
      [ticketId],
    )

    const events: Array<Record<string, unknown>> = [
      {
        type: 'created',
        title: 'Ticket created',
        description: ticket.title,
        userId: ticket.requesterUserId,
        userName: ticket.requesterName,
        userRole: ticket.requesterRole,
        timestamp: ticket.createdAt,
      },
    ]

    if (ticket.assignedEmployeeId !== null) {
      events.push({
        type: 'assigned',
        title: 'Ticket assigned',
        userId: ticket.assignedEmployeeId,
        userName: ticket.assignedEmployeeName,
        timestamp: ticket.updatedAt,
      })
    }

    for (const transfer of transfers) {
      events.push({
        type: 'transfer_requested',
        title: 'Transfer requested',
        userId: transfer.requestedByUserId,
        userName: transfer.requestedByName,
        fromDepartmentId: transfer.fromDepartmentId,
        fromDepartmentName: transfer.fromDepartmentName,
        toDepartmentId: transfer.toDepartmentId,
        toDepartmentName: transfer.toDepartmentName,
        reason: transfer.reason,
        status: transfer.status,
        timestamp: transfer.createdAt,
      })

      if (transfer.reviewedAt) {
        events.push({
          type: 'transfer_reviewed',
          title:
            transfer.status === 'approved'
              ? 'Transfer approved'
              : 'Transfer rejected',
          userId: transfer.reviewedByUserId,
          userName: transfer.reviewedByName,
          status: transfer.status,
          reviewComment: transfer.reviewComment,
          fromDepartmentName: transfer.fromDepartmentName,
          toDepartmentName: transfer.toDepartmentName,
          timestamp: transfer.reviewedAt,
        })
      }
    }

    events.sort(
      (a, b) =>
        new Date(a.timestamp as string | Date).getTime() -
        new Date(b.timestamp as string | Date).getTime(),
    )

    res.status(200).json({
      success: true,
      ticket,
      events,
    })
  } catch (error) {
    console.error('Get ticket lifecycle error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to load the ticket lifecycle.',
    })
  }
}
