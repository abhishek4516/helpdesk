import type { Request, Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'

async function canAccessTicket(ticketId: number, user: NonNullable<Request['user']>) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.requester_user_id AS requesterUserId,
            t.assigned_employee_id AS assignedEmployeeId,
            t.department_id AS departmentId, t.status, d.head_user_id AS headUserId
     FROM tickets t JOIN departments d ON d.id = t.department_id
     WHERE t.id = ? LIMIT 1`, [ticketId],
  )
  if (!rows.length) return null
  const ticket = rows[0]
  const allowed = user.role === 'master' || ticket.requesterUserId === user.id ||
    ticket.assignedEmployeeId === user.id ||
    (user.role === 'department_head' && ticket.headUserId === user.id)
  return allowed ? ticket : null
}

export async function getTicketComments(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) { res.status(400).json({ success: false, message: 'Invalid ticket ID.' }); return }
    const ticket = await canAccessTicket(ticketId, user)
    if (!ticket) { res.status(404).json({ success: false, message: 'Ticket not found or access denied.' }); return }
    const [comments] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.comment, c.created_at AS createdAt,
              u.id AS userId, u.full_name AS userName, u.role AS userRole
       FROM ticket_comments c JOIN users u ON u.id = c.user_id
       WHERE c.ticket_id = ? ORDER BY c.created_at ASC, c.id ASC`, [ticketId],
    )
    res.json({ success: true, comments })
  } catch (error) {
    console.error('Get ticket comments error:', error)
    res.status(500).json({ success: false, message: 'Unable to load comments.' })
  }
}

export async function addTicketComment(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : ''
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0 || comment.length < 1 || comment.length > 10000) {
      res.status(400).json({ success: false, message: 'Enter a comment of 1–10000 characters.' }); return
    }
    const ticket = await canAccessTicket(ticketId, user)
    if (!ticket) { res.status(404).json({ success: false, message: 'Ticket not found or access denied.' }); return }
    if (['closed', 'transfer_pending', 'resolution_pending'].includes(String(ticket.status).toLowerCase())) {
      res.status(409).json({ success: false, message: 'Comments are disabled while this ticket is closed or awaiting a decision.' }); return
    }
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute<ResultSetHeader>(
        `INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)`, [ticketId, user.id, comment],
      )
      await connection.execute(
        `INSERT INTO ticket_activities (ticket_id, actor_user_id, event_type, title, description)
         VALUES (?, ?, 'comment_added', 'Comment added', ?)`, [ticketId, user.id, comment],
      )
      await connection.commit()
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
    res.status(201).json({ success: true, message: 'Comment added.' })
  } catch (error) {
    console.error('Add ticket comment error:', error)
    res.status(500).json({ success: false, message: 'Unable to add comment.' })
  }
}

export async function submitTicketResolution(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    const resolutionComment = typeof req.body.resolutionComment === 'string' ? req.body.resolutionComment.trim() : ''
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0 || resolutionComment.length < 5 || resolutionComment.length > 10000) {
      res.status(400).json({ success: false, message: 'Provide a resolution of 5–10000 characters.' }); return
    }
    const connection = await pool.getConnection()
    let resolutionId = 0
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, requester_user_id AS requesterUserId, assigned_employee_id AS assignedEmployeeId, status
         FROM tickets WHERE id = ? FOR UPDATE`, [ticketId],
      )
      if (!rows.length) { await connection.rollback(); res.status(404).json({ success: false, message: 'Ticket not found.' }); return }
      const ticket = rows[0]
      if (user.role !== 'employee' || ticket.assignedEmployeeId !== user.id) {
        await connection.rollback(); res.status(403).json({ success: false, message: 'Only the assigned employee can submit a resolution.' }); return
      }
      if (!['assigned', 'in_progress'].includes(String(ticket.status).toLowerCase())) {
        await connection.rollback(); res.status(409).json({ success: false, message: 'This ticket cannot accept a resolution right now.' }); return
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO ticket_resolution_requests (ticket_id, submitted_by_user_id, resolution_comment)
         VALUES (?, ?, ?)`, [ticketId, user.id, resolutionComment],
      )
      resolutionId = result.insertId
      await connection.execute(`UPDATE tickets SET status = 'resolution_pending' WHERE id = ?`, [ticketId])
      await connection.execute(
        `INSERT INTO ticket_activities (ticket_id, actor_user_id, event_type, title, description)
         VALUES (?, ?, 'resolution_submitted', 'Resolution submitted for approval', ?)`, [ticketId, user.id, resolutionComment],
      )
      await connection.commit()
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
    res.status(201).json({ success: true, message: 'Resolution sent to the requester for approval.', resolutionId })
  } catch (error) {
    console.error('Submit resolution error:', error)
    res.status(500).json({ success: false, message: 'Unable to submit resolution.' })
  }
}

export async function reviewTicketResolution(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection()
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    const resolutionId = Number(req.params.resolutionId)
    const decision = req.body.decision
    const reviewComment = typeof req.body.reviewComment === 'string' ? req.body.reviewComment.trim() : null
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || !Number.isSafeInteger(resolutionId) || !['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ success: false, message: 'Invalid resolution review details.' }); return
    }
    await connection.beginTransaction()
    const [tickets] = await connection.execute<RowDataPacket[]>(
      `SELECT id, requester_user_id AS requesterUserId, status FROM tickets WHERE id = ? FOR UPDATE`, [ticketId],
    )
    if (!tickets.length) { await connection.rollback(); res.status(404).json({ success: false, message: 'Ticket not found.' }); return }
    if (tickets[0].requesterUserId !== user.id) { await connection.rollback(); res.status(403).json({ success: false, message: 'Only the original requester can review this resolution.' }); return }
    const [requests] = await connection.execute<RowDataPacket[]>(
      `SELECT id, resolution_comment AS resolutionComment, status FROM ticket_resolution_requests
       WHERE id = ? AND ticket_id = ? FOR UPDATE`, [resolutionId, ticketId],
    )
    if (!requests.length || requests[0].status !== 'pending' || String(tickets[0].status).toLowerCase() !== 'resolution_pending') {
      await connection.rollback(); res.status(409).json({ success: false, message: 'This resolution is no longer pending.' }); return
    }
    await connection.execute(
      `UPDATE ticket_resolution_requests SET status = ?, reviewed_by_user_id = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [decision, user.id, reviewComment, resolutionId],
    )
    if (decision === 'approved') {
      await connection.execute(
        `UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP,
         reopen_until = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY) WHERE id = ?`, [ticketId],
      )
    } else {
      await connection.execute(
        `UPDATE tickets SET status = 'open', assigned_employee_id = NULL, closed_at = NULL, reopen_until = NULL WHERE id = ?`, [ticketId],
      )
    }
    await connection.execute(
      `INSERT INTO ticket_activities (ticket_id, actor_user_id, event_type, title, description, metadata)
       VALUES (?, ?, ?, ?, ?, JSON_OBJECT('resolutionId', ?, 'reviewComment', ?))`,
      [ticketId, user.id, `resolution_${decision}`, decision === 'approved' ? 'Resolution approved — ticket closed' : 'Resolution rejected — returned to department head', reviewComment, resolutionId, reviewComment],
    )
    await connection.commit()
    res.json({ success: true, message: decision === 'approved' ? 'Resolution approved. Ticket closed.' : 'Resolution rejected. Ticket returned to the department head.' })
  } catch (error) {
    await connection.rollback()
    console.error('Review resolution error:', error)
    res.status(500).json({ success: false, message: 'Unable to review resolution.' })
  } finally { connection.release() }
}

export async function reopenTicket(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection()
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) { res.status(400).json({ success: false, message: 'Invalid ticket ID.' }); return }
    await connection.beginTransaction()
    const [tickets] = await connection.execute<RowDataPacket[]>(
      `SELECT id, requester_user_id AS requesterUserId, status, reopen_until AS reopenUntil
       FROM tickets WHERE id = ? FOR UPDATE`, [ticketId],
    )
    if (!tickets.length) { await connection.rollback(); res.status(404).json({ success: false, message: 'Ticket not found.' }); return }
    const ticket = tickets[0]
    if (ticket.requesterUserId !== user.id) { await connection.rollback(); res.status(403).json({ success: false, message: 'Only the original requester can reopen this ticket.' }); return }
    if (String(ticket.status).toLowerCase() !== 'closed' || !ticket.reopenUntil || new Date(ticket.reopenUntil).getTime() < Date.now()) {
      await connection.rollback(); res.status(409).json({ success: false, message: 'This ticket is outside the 7-day reopening window.' }); return
    }
    await connection.execute(
      `UPDATE tickets SET status = 'open', assigned_employee_id = NULL, closed_at = NULL, reopen_until = NULL WHERE id = ?`, [ticketId],
    )
    await connection.execute(
      `INSERT INTO ticket_activities (ticket_id, actor_user_id, event_type, title, description)
       VALUES (?, ?, 'reopened', 'Ticket reopened', 'Requester reopened the ticket within the allowed 7-day period.')`, [ticketId, user.id],
    )
    await connection.commit()
    res.json({ success: true, message: 'Ticket reopened and returned to the department head queue.' })
  } catch (error) {
    await connection.rollback()
    console.error('Reopen ticket error:', error)
    res.status(500).json({ success: false, message: 'Unable to reopen ticket.' })
  } finally { connection.release() }
}

export async function changeTicketPriority(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection()
  try {
    const user = req.user
    const ticketId = Number(req.params.id)
    const priority = req.body.priority
    if (!user) { res.status(401).json({ success: false, message: 'Please log in.' }); return }
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0 || !['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
      res.status(400).json({ success: false, message: 'Provide a valid ticket ID and priority.' }); return
    }
    if (!['master', 'department_head'].includes(user.role)) { res.status(403).json({ success: false, message: 'Only a department head or master can change priority.' }); return }
    await connection.beginTransaction()
    const [tickets] = await connection.execute<RowDataPacket[]>(
      `SELECT t.id, t.priority, d.head_user_id AS headUserId
       FROM tickets t JOIN departments d ON d.id = t.department_id WHERE t.id = ? FOR UPDATE`, [ticketId],
    )
    if (!tickets.length) { await connection.rollback(); res.status(404).json({ success: false, message: 'Ticket not found.' }); return }
    if (user.role === 'department_head' && tickets[0].headUserId !== user.id) {
      await connection.rollback(); res.status(403).json({ success: false, message: 'You can change priority only in your department.' }); return
    }
    const previousPriority = tickets[0].priority
    if (previousPriority === priority) { await connection.rollback(); res.json({ success: true, message: 'Priority is unchanged.' }); return }
    await connection.execute(`UPDATE tickets SET priority = ? WHERE id = ?`, [priority, ticketId])
    await connection.execute(
      `INSERT INTO ticket_activities (ticket_id, actor_user_id, event_type, title, description, metadata)
       VALUES (?, ?, 'priority_changed', 'Ticket priority changed', ?, JSON_OBJECT('from', ?, 'to', ?))`,
      [ticketId, user.id, `${previousPriority} → ${priority}`, previousPriority, priority],
    )
    await connection.commit()
    res.json({ success: true, message: 'Ticket priority updated.' })
  } catch (error) {
    await connection.rollback()
    console.error('Change ticket priority error:', error)
    res.status(500).json({ success: false, message: 'Unable to update ticket priority.' })
  } finally { connection.release() }
}
