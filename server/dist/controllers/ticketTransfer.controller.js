"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestTicketTransfer = requestTicketTransfer;
exports.getTicketTransferRequests = getTicketTransferRequests;
exports.reviewTicketTransfer = reviewTicketTransfer;
const database_js_1 = require("../config/database.js");
// Submit a transfer request
async function requestTicketTransfer(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to request a transfer.',
            });
            return;
        }
        const ticketId = Number(req.params.id);
        const toDepartmentId = Number(req.body.toDepartmentId);
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (!Number.isSafeInteger(ticketId) ||
            ticketId <= 0 ||
            !Number.isSafeInteger(toDepartmentId) ||
            toDepartmentId <= 0 ||
            reason.length < 5 ||
            reason.length > 2000) {
            res.status(400).json({
                success: false,
                message: 'Provide a valid ticket, destination department, and a reason of 5–2000 characters.',
            });
            return;
        }
        const [tickets] = await database_js_1.pool.execute(`SELECT id, department_id AS departmentId,
              assigned_employee_id AS assignedEmployeeId
       FROM tickets
       WHERE id = ?
       LIMIT 1`, [ticketId]);
        if (tickets.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Ticket not found.',
            });
            return;
        }
        const ticket = tickets[0];
        // A transfer can be requested only by the currently assigned employee.
        if (user.role !== 'employee' || ticket.assignedEmployeeId !== user.id) {
            res.status(403).json({
                success: false,
                message: 'Only the assigned employee can request this transfer.',
            });
            return;
        }
        if (ticket.status === 'transfer_pending') {
            res.status(409).json({ success: false, message: 'A transfer is already pending for this ticket.' });
            return;
        }
        if (ticket.departmentId === toDepartmentId) {
            res.status(400).json({
                success: false,
                message: 'Choose a different destination department.',
            });
            return;
        }
        const [departments] = await database_js_1.pool.execute(`SELECT id
       FROM departments
       WHERE id = ? AND is_active = 1
       LIMIT 1`, [toDepartmentId]);
        if (departments.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Choose an active destination department.',
            });
            return;
        }
        const [pending] = await database_js_1.pool.execute(`SELECT id
       FROM ticket_transfer_requests
       WHERE ticket_id = ? AND status = 'pending'
       LIMIT 1`, [ticketId]);
        if (pending.length > 0) {
            res.status(409).json({
                success: false,
                message: 'This ticket already has a pending transfer request.',
            });
            return;
        }
        const connection = await database_js_1.pool.getConnection();
        let requestId = 0;
        try {
            await connection.beginTransaction();
            const [locked] = await connection.execute(`SELECT id, department_id AS departmentId, assigned_employee_id AS assignedEmployeeId, status
         FROM tickets WHERE id = ? FOR UPDATE`, [ticketId]);
            if (!locked.length || locked[0].assignedEmployeeId !== user.id || locked[0].status === 'transfer_pending') {
                await connection.rollback();
                res.status(409).json({ success: false, message: 'The ticket changed or already has a pending transfer.' });
                return;
            }
            const [insertResult] = await connection.execute(`INSERT INTO ticket_transfer_requests
          (ticket_id, requested_by_user_id, from_department_id, to_department_id,
           reason, previous_ticket_status, previous_assigned_employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [ticketId, user.id, ticket.departmentId, toDepartmentId, reason, locked[0].status, user.id]);
            requestId = insertResult.insertId;
            await connection.execute(`UPDATE tickets SET status = 'transfer_pending' WHERE id = ?`, [ticketId]);
            await connection.execute(`INSERT INTO ticket_activities
         (ticket_id, actor_user_id, event_type, title, description, from_department_id, to_department_id)
         VALUES (?, ?, 'transfer_requested', 'Department transfer requested', ?, ?, ?)`, [ticketId, user.id, reason, ticket.departmentId, toDepartmentId]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
        res.status(201).json({
            success: true,
            message: 'Transfer request submitted for approval.',
            requestId,
        });
    }
    catch (error) {
        console.error('Request ticket transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to submit the transfer request.',
        });
    }
}
// List transfer requests visible to the signed-in user
async function getTicketTransferRequests(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to view transfer requests.',
            });
            return;
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
        td.head_user_id AS destinationHeadUserId,
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
    `;
        const params = [];
        if (user.role === 'master') {
            // Master can view all transfer requests.
        }
        else if (user.role === 'department_head') {
            sql += `
        WHERE (
          td.head_user_id = ?
          OR tr.requested_by_user_id = ?
        )
      `;
            params.push(user.id, user.id);
        }
        else {
            sql += ` WHERE tr.requested_by_user_id = ?`;
            params.push(user.id);
        }
        sql += ' ORDER BY tr.created_at DESC';
        const [requests] = await database_js_1.pool.execute(sql, params);
        res.status(200).json({
            success: true,
            requests,
        });
    }
    catch (error) {
        console.error('Get ticket transfer requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to load transfer requests.',
        });
    }
}
// Approve or reject a transfer request
async function reviewTicketTransfer(req, res) {
    const connection = await database_js_1.pool.getConnection();
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to review transfer requests.',
            });
            return;
        }
        if (!['master', 'department_head'].includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'Only the master or an authorized department head can review requests.',
            });
            return;
        }
        const requestId = Number(req.params.id);
        const decision = req.body.decision;
        const reviewComment = typeof req.body.reviewComment === 'string'
            ? req.body.reviewComment.trim()
            : null;
        if (!Number.isSafeInteger(requestId) ||
            requestId <= 0 ||
            !['approved', 'rejected'].includes(decision)) {
            res.status(400).json({
                success: false,
                message: 'Provide a valid request ID and an approved or rejected decision.',
            });
            return;
        }
        await connection.beginTransaction();
        const [requests] = await connection.execute(`SELECT
         id,
         ticket_id AS ticketId,
         requested_by_user_id AS requesterUserId,
         from_department_id AS fromDepartmentId,
         to_department_id AS toDepartmentId,
         reason,
         status,
         previous_ticket_status AS previousTicketStatus,
         previous_assigned_employee_id AS previousAssignedEmployeeId
       FROM ticket_transfer_requests
       WHERE id = ?
       FOR UPDATE`, [requestId]);
        if (requests.length === 0) {
            await connection.rollback();
            res.status(404).json({
                success: false,
                message: 'Transfer request not found.',
            });
            return;
        }
        const transfer = requests[0];
        if (transfer.status !== 'pending') {
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: 'This transfer request has already been reviewed.',
            });
            return;
        }
        // A department head may review only as the destination department head.
        if (user.role === 'department_head') {
            const [departments] = await connection.execute(`SELECT id, head_user_id AS headUserId
         FROM departments
         WHERE id IN (?, ?)`, [transfer.fromDepartmentId, transfer.toDepartmentId]);
            const destination = departments.find((department) => department.id === transfer.toDepartmentId);
            const isAuthorizedHead = destination?.headUserId === user.id;
            if (!isAuthorizedHead) {
                await connection.rollback();
                res.status(403).json({
                    success: false,
                    message: 'Only the destination department head can review this transfer.',
                });
                return;
            }
        }
        const [tickets] = await connection.execute(`SELECT id, department_id AS departmentId,
              assigned_employee_id AS assignedEmployeeId, status
       FROM tickets WHERE id = ? FOR UPDATE`, [transfer.ticketId]);
        if (!tickets.length || tickets[0].departmentId !== transfer.fromDepartmentId || tickets[0].status !== 'transfer_pending') {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'The ticket state has changed. This transfer cannot be reviewed.' });
            return;
        }
        await connection.execute(`INSERT INTO ticket_transfer_reviews
       (transfer_request_id, reviewer_user_id, reviewer_type, decision, review_comment)
       VALUES (?, ?, ?, ?, ?)`, [requestId, user.id, user.role === 'master' ? 'master' : 'destination_head', decision, reviewComment]);
        if (decision === 'approved') {
            await connection.execute(`UPDATE tickets SET department_id = ?, assigned_employee_id = NULL, status = 'open'
         WHERE id = ?`, [transfer.toDepartmentId, transfer.ticketId]);
        }
        else {
            await connection.execute(`UPDATE tickets SET status = ?, assigned_employee_id = ? WHERE id = ?`, [transfer.previousTicketStatus ?? 'assigned',
                transfer.previousAssignedEmployeeId ?? tickets[0].assignedEmployeeId, transfer.ticketId]);
        }
        await connection.execute(`UPDATE ticket_transfer_requests
       SET status = ?, reviewed_by_user_id = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`, [decision, user.id, reviewComment, requestId]);
        await connection.execute(`INSERT INTO ticket_activities
       (ticket_id, actor_user_id, event_type, title, description, from_department_id, to_department_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, JSON_OBJECT('decision', ?))`, [transfer.ticketId, user.id, `transfer_${decision}`, decision === 'approved' ? 'Department transfer approved' : 'Department transfer rejected', reviewComment, transfer.fromDepartmentId, transfer.toDepartmentId, decision]);
        await connection.commit();
        res.status(200).json({
            success: true,
            message: decision === 'approved'
                ? 'Transfer approved. The ticket has moved to the destination department.'
                : 'Transfer request rejected. The ticket remains in its current department.',
        });
    }
    catch (error) {
        await connection.rollback();
        console.error('Review ticket transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to review the transfer request.',
        });
    }
    finally {
        connection.release();
    }
}
