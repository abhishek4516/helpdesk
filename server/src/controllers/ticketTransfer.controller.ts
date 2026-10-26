
import type { Request, Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'

interface TransferRequestRow extends RowDataPacket {
  id: number
  ticketId: number
  requesterUserId: number
  fromDepartmentId: number
  toDepartmentId: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
}

interface TicketDepartmentRow extends RowDataPacket {
  id: number
  departmentId: number
  assignedEmployeeId: number | null
}

interface DepartmentHeadRow extends RowDataPacket {
  headUserId: number | null
}

// Submit a transfer request
export async function requestTicketTransfer(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to request a transfer.',
      })
      return
    }

    const ticketId = Number(req.params.id)
    const toDepartmentId = Number(req.body.toDepartmentId)
    const reason =
      typeof req.body.reason === 'string' ? req.body.reason.trim() : ''

    if (
      !Number.isSafeInteger(ticketId) ||
      ticketId <= 0 ||
      !Number.isSafeInteger(toDepartmentId) ||
      toDepartmentId <= 0 ||
      reason.length < 5 ||
      reason.length > 2000
    ) {
      res.status(400).json({
        success: false,
        message:
          'Provide a valid ticket, destination department, and a reason of 5–2000 characters.',
      })
      return
    }

    const [tickets] = await pool.execute<TicketDepartmentRow[]>(
      `SELECT id, department_id AS departmentId,
              assigned_employee_id AS assignedEmployeeId
       FROM tickets
       WHERE id = ?
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

    // Only the currently assigned employee or the master may request a transfer.
    if (
      user.role !== 'master' &&
      ticket.assignedEmployeeId !== user.id
    ) {
      res.status(403).json({
        success: false,
        message: 'Only the assigned employee can request this transfer.',
      })
      return
    }

    if (ticket.departmentId === toDepartmentId) {
      res.status(400).json({
        success: false,
        message: 'Choose a different destination department.',
      })
      return
    }

    const [departments] = await pool.execute<RowDataPacket[]>(
      `SELECT id
       FROM departments
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [toDepartmentId],
    )

    if (departments.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Choose an active destination department.',
      })
      return
    }

    const [pending] = await pool.execute<RowDataPacket[]>(
      `SELECT id
       FROM ticket_transfer_requests
       WHERE ticket_id = ? AND status = 'pending'
       LIMIT 1`,
      [ticketId],
    )

    if (pending.length > 0) {
      res.status(409).json({
        success: false,
        message: 'This ticket already has a pending transfer request.',
      })
      return
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ticket_transfer_requests
        (ticket_id, requested_by_user_id, from_department_id,
         to_department_id, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [ticketId, user.id, ticket.departmentId, toDepartmentId, reason],
    )

    res.status(201).json({
      success: true,
      message: 'Transfer request submitted for approval.',
      requestId: result.insertId,
    })
  } catch (error) {
    console.error('Request ticket transfer error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to submit the transfer request.',
    })
  }
}

// List transfer requests visible to the signed-in user
export async function getTicketTransferRequests(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to view transfer requests.',
      })
      return
    }

    let sql = `
      SELECT
        tr.id,
        tr.ticket_id AS ticketId,
        t.ticket_code AS ticketCode,
        t.title,
        tr.requested_by_user_id AS requestedByUserId,
        requester.full_name AS requestedByName,
        tr.from_department_id AS fromDepartmentId,
        fd.name AS fromDepartmentName,
        tr.to_department_id AS toDepartmentId,
        td.name AS toDepartmentName,
        tr.reason,
        tr.status,
        tr.reviewed_by_user_id AS reviewedByUserId,
        reviewer.full_name AS reviewedByName,
        tr.review_comment AS reviewComment,
        tr.created_at AS createdAt,
        tr.reviewed_at AS reviewedAt
      FROM ticket_transfer_requests tr
      INNER JOIN tickets t ON t.id = tr.ticket_id
      INNER JOIN departments fd ON fd.id = tr.from_department_id
      INNER JOIN departments td ON td.id = tr.to_department_id
      INNER JOIN users requester ON requester.id = tr.requested_by_user_id
      LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by_user_id
    `

    const params: number[] = []

    if (user.role === 'master') {
      // Master can view all transfer requests.
    } else if (user.role === 'department_head') {
      sql += `
        WHERE (
          fd.head_user_id = ?
          OR td.head_user_id = ?
          OR tr.requested_by_user_id = ?
        )
      `
      params.push(user.id, user.id, user.id)
    } else {
      sql += ` WHERE tr.requested_by_user_id = ?`
      params.push(user.id)
    }

    sql += ' ORDER BY tr.created_at DESC'

    const [requests] = await pool.execute<RowDataPacket[]>(sql, params)

    res.status(200).json({
      success: true,
      requests,
    })
  } catch (error) {
    console.error('Get ticket transfer requests error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to load transfer requests.',
    })
  }
}

// Approve or reject a transfer request
export async function reviewTicketTransfer(
  req: Request,
  res: Response,
): Promise<void> {
  const connection = await pool.getConnection()

  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Please log in to review transfer requests.',
      })
      return
    }

    if (!['master', 'department_head'].includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Only the master or an authorized department head can review requests.',
      })
      return
    }

    const requestId = Number(req.params.id)
    const decision = req.body.decision
    const reviewComment =
      typeof req.body.reviewComment === 'string'
        ? req.body.reviewComment.trim()
        : null

    if (
      !Number.isSafeInteger(requestId) ||
      requestId <= 0 ||
      !['approved', 'rejected'].includes(decision)
    ) {
      res.status(400).json({
        success: false,
        message: 'Provide a valid request ID and an approved or rejected decision.',
      })
      return
    }

    await connection.beginTransaction()

    const [requests] = await connection.execute<TransferRequestRow[]>(
      `SELECT
         id,
         ticket_id AS ticketId,
         requested_by_user_id AS requesterUserId,
         from_department_id AS fromDepartmentId,
         to_department_id AS toDepartmentId,
         reason,
         status
       FROM ticket_transfer_requests
       WHERE id = ?
       FOR UPDATE`,
      [requestId],
    )

    if (requests.length === 0) {
      await connection.rollback()
      res.status(404).json({
        success: false,
        message: 'Transfer request not found.',
      })
      return
    }

    const transfer = requests[0]

    if (transfer.status !== 'pending') {
      await connection.rollback()
      res.status(409).json({
        success: false,
        message: 'This transfer request has already been reviewed.',
      })
      return
    }

    // Department heads may review only requests involving their own department.
    if (user.role === 'department_head') {
      const [departments] = await connection.execute<DepartmentHeadRow[]>(
        `SELECT id, head_user_id AS headUserId
         FROM departments
         WHERE id IN (?, ?)`,
        [transfer.fromDepartmentId, transfer.toDepartmentId],
      )

      const isAuthorizedHead = departments.some(
        (department) => department.headUserId === user.id,
      )

      if (!isAuthorizedHead) {
        await connection.rollback()
        res.status(403).json({
          success: false,
          message: 'You can review only transfers involving your department.',
        })
        return
      }
    }

    if (decision === 'approved') {
      const [tickets] = await connection.execute<TicketDepartmentRow[]>(
        `SELECT id, department_id AS departmentId,
                assigned_employee_id AS assignedEmployeeId
         FROM tickets
         WHERE id = ?
         FOR UPDATE`,
        [transfer.ticketId],
      )

      if (
        tickets.length === 0 ||
        tickets[0].departmentId !== transfer.fromDepartmentId
      ) {
        await connection.rollback()
        res.status(409).json({
          success: false,
          message: 'The ticket department has changed. Please review the request again.',
        })
        return
      }

      await connection.execute(
        `UPDATE tickets
         SET department_id = ?
         WHERE id = ?`,
        [transfer.toDepartmentId, transfer.ticketId],
      )
    }

    await connection.execute(
      `UPDATE ticket_transfer_requests
       SET status = ?,
           reviewed_by_user_id = ?,
           review_comment = ?,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [decision, user.id, reviewComment, requestId],
    )

    await connection.commit()

    res.status(200).json({
      success: true,
      message:
        decision === 'approved'
          ? 'Transfer approved. The ticket has moved to the destination department.'
          : 'Transfer request rejected. The ticket remains in its current department.',
    })
  } catch (error) {
    await connection.rollback()
    console.error('Review ticket transfer error:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to review the transfer request.',
    })
  } finally {
    connection.release()
  }
}
