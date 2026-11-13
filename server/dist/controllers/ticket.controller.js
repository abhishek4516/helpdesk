"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartments = getDepartments;
exports.createTicket = createTicket;
exports.getTickets = getTickets;
exports.assignTicket = assignTicket;
exports.getTicketLifecycle = getTicketLifecycle;
const node_crypto_1 = require("node:crypto");
const database_js_1 = require("../config/database.js");
const ticket_validator_js_1 = require("../validators/ticket.validator.js");
async function getDepartments(_req, res) {
    try {
        const [departments] = await database_js_1.pool.query(`
      SELECT
        id,
        name,
        department_code AS departmentCode
      FROM departments
      WHERE is_active = 1
      ORDER BY name ASC
    `);
        res.status(200).json({ success: true, departments });
    }
    catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ success: false, message: 'Unable to load departments.' });
    }
}
async function createTicket(req, res) {
    try {
        const validation = ticket_validator_js_1.createTicketSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                message: validation.error.issues[0]?.message ?? 'Invalid ticket details.',
            });
            return;
        }
        const { title, description, departmentId } = validation.data;
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: 'Please log in to create a ticket.' });
            return;
        }
        const [departments] = await database_js_1.pool.execute(`SELECT
  id,
  name,
  department_code AS departmentCode,
  head_user_id AS headUserId
FROM departments
WHERE id = ? AND is_active = 1
LIMIT 1`, [departmentId]);
        if (departments.length === 0) {
            res.status(400).json({ success: false, message: 'Please select an active department.' });
            return;
        }
        const ticketCode = `HD-${(0, node_crypto_1.randomBytes)(6).toString('hex').toUpperCase()}`;
        const [result] = await database_js_1.pool.execute(`INSERT INTO tickets
       (ticket_code, title, description, requester_user_id, department_id, status)
       VALUES (?, ?, ?, ?, ?, 'open')`, [ticketCode, title, description, user.id, departmentId]);
        const departmentHeadId = departments[0].headUserId;
        if (departmentHeadId && departmentHeadId !== user.id) {
            await database_js_1.pool.execute(`INSERT INTO notifications
      (recipient_user_id, ticket_id, notification_type, title, message)
     VALUES (?, ?, ?, ?, ?)`, [
                departmentHeadId,
                result.insertId,
                'ticket_created',
                'New ticket received',
                `${user.name} raised a new ticket: ${title}`,
            ]);
        }
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
        });
    }
    catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ success: false, message: 'Unable to create the ticket. Please try again.' });
    }
}
async function getTickets(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: 'Please log in to view tickets.' });
            return;
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
        requesterDepartment.name AS requesterDepartmentName,
        t.assigned_employee_id AS assignedEmployeeId,
        assignee.full_name AS assignedEmployeeName,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tickets t
      INNER JOIN departments d ON d.id = t.department_id
      INNER JOIN users u ON u.id = t.requester_user_id
      LEFT JOIN departments requesterDepartment
        ON requesterDepartment.id = u.department_id
      LEFT JOIN users assignee
        ON assignee.id = t.assigned_employee_id
    `;
        const params = [];
        if (user.role === 'master') {
        }
        else if (user.role === 'department_head') {
            sql += ' WHERE d.head_user_id = ?';
            params.push(user.id);
        }
        else {
            sql += ' WHERE (t.requester_user_id = ? OR t.assigned_employee_id = ?)';
            params.push(user.id, user.id);
        }
        sql += ' ORDER BY t.created_at DESC';
        const [tickets] = await database_js_1.pool.execute(sql, params);
        res.status(200).json({ success: true, tickets });
    }
    catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ success: false, message: 'Unable to load tickets.' });
    }
}
async function assignTicket(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to assign tickets.',
            });
            return;
        }
        if (user.role !== 'master' && user.role !== 'department_head') {
            res.status(403).json({
                success: false,
                message: 'Only master users or department heads can assign tickets.',
            });
            return;
        }
        const ticketId = Number(req.params.id);
        const employeeId = Number(req.body.employeeId);
        if (!Number.isSafeInteger(ticketId) || ticketId <= 0 ||
            !Number.isSafeInteger(employeeId) || employeeId <= 0) {
            res.status(400).json({
                success: false,
                message: 'A valid ticket ID and employee ID are required.',
            });
            return;
        }
        const [tickets] = await database_js_1.pool.execute(`SELECT
         t.id,
         t.ticket_code AS ticketCode,
         t.title,
         t.department_id AS departmentId,
         t.status
       FROM tickets t
       INNER JOIN departments d ON d.id = t.department_id
       WHERE t.id = ?
         AND (? = 'master' OR d.head_user_id = ?)
       LIMIT 1`, [ticketId, user.role, user.id]);
        if (tickets.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Ticket not found in your accessible departments.',
            });
            return;
        }
        const ticket = tickets[0];
        if (ticket.status !== 'open') {
            res.status(409).json({
                success: false,
                message: 'Only open, unassigned tickets can be assigned.',
            });
            return;
        }
        const employeeSql = user.role === 'department_head'
            ? `SELECT id, full_name AS fullName FROM users
           WHERE id = ?
             AND department_id = ?
             AND is_active = 1
             AND role = 'employee'
           LIMIT 1`
            : `SELECT id, full_name AS fullName FROM users
           WHERE id = ?
             AND is_active = 1
             AND role IN ('employee', 'department_head')
           LIMIT 1`;
        const employeeParams = user.role === 'department_head'
            ? [employeeId, ticket.departmentId]
            : [employeeId];
        const [employees] = await database_js_1.pool.execute(employeeSql, employeeParams);
        if (employees.length === 0) {
            res.status(400).json({
                success: false,
                message: user.role === 'department_head'
                    ? 'Select an active employee from your department.'
                    : 'Select an active employee or department head.',
            });
            return;
        }
        const connection = await database_js_1.pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(`UPDATE tickets
         SET assigned_employee_id = ?,
             status = 'assigned'
         WHERE id = ?
           AND status = 'open'
           AND assigned_employee_id IS NULL`, [employeeId, ticketId]);
            if (result.affectedRows === 0) {
                await connection.rollback();
                res.status(409).json({
                    success: false,
                    message: 'This ticket has already been assigned or its status changed.',
                });
                return;
            }
            await connection.execute(`INSERT INTO ticket_activities
           (ticket_id, actor_user_id, event_type, title, description, to_employee_id)
         VALUES (?, ?, 'assigned', 'Ticket assigned', ?, ?)`, [ticketId, user.id, `Assigned to ${employees[0].fullName}`, employeeId]);
            if (employeeId !== Number(user.id)) {
                await connection.execute(`INSERT INTO notifications
             (recipient_user_id, ticket_id, notification_type, title, message)
           VALUES (?, ?, ?, ?, ?)`, [
                    employeeId,
                    ticketId,
                    'ticket_assigned',
                    'New ticket assigned',
                    `Ticket ${ticket.ticketCode}: ${ticket.title} has been assigned to you.`,
                ]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
        res.status(200).json({
            success: true,
            message: 'Ticket assigned successfully.',
        });
    }
    catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to assign the ticket. Please try again.',
        });
    }
}
async function getTicketLifecycle(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to view the ticket lifecycle.',
            });
            return;
        }
        const ticketId = Number(req.params.id);
        if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
            res.status(400).json({
                success: false,
                message: 'A valid ticket ID is required.',
            });
            return;
        }
        const [tickets] = await database_js_1.pool.execute(`SELECT
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
       LIMIT 1`, [ticketId]);
        if (tickets.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Ticket not found.',
            });
            return;
        }
        const ticket = tickets[0];
        if (user.role === 'department_head') {
            const [visible] = await database_js_1.pool.execute(`SELECT id
         FROM departments
         WHERE id = ? AND head_user_id = ?
         LIMIT 1`, [ticket.departmentId, user.id]);
            if (visible.length === 0) {
                res.status(403).json({
                    success: false,
                    message: 'You cannot view this ticket lifecycle.',
                });
                return;
            }
        }
        else if (user.role !== 'master' &&
            ticket.requesterUserId !== user.id &&
            ticket.assignedEmployeeId !== user.id) {
            res.status(403).json({
                success: false,
                message: 'You cannot view this ticket lifecycle.',
            });
            return;
        }
        const [activityRows] = await database_js_1.pool.execute(`SELECT
         a.id,
         a.event_type AS eventType,
         a.title,
         a.description,
         a.created_at AS timestamp,
         actor.full_name AS actorName,
         actor.role AS actorRole,
         target.full_name AS toEmployeeName
       FROM ticket_activities a
       LEFT JOIN users actor ON actor.id = a.actor_user_id
       LEFT JOIN users target ON target.id = a.to_employee_id
       WHERE a.ticket_id = ?
         AND a.event_type NOT IN ('created', 'transfer_requested', 'transfer_reviewed')
       ORDER BY a.created_at ASC, a.id ASC`, [ticketId]);
        const [transfers] = await database_js_1.pool.execute(`SELECT
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
       ORDER BY tr.created_at ASC, tr.id ASC`, [ticketId]);
        const events = [
            {
                type: 'created',
                title: 'Ticket created',
                description: ticket.title,
                userId: ticket.requesterUserId,
                userName: ticket.requesterName,
                userRole: ticket.requesterRole,
                timestamp: ticket.createdAt,
            },
        ];
        const hasAssignmentActivity = activityRows.some((activity) => String(activity.eventType).toLowerCase() === 'assigned');
        if (ticket.assignedEmployeeId !== null && !hasAssignmentActivity) {
            events.push({
                type: 'assigned',
                title: 'Ticket assigned',
                userId: ticket.assignedEmployeeId,
                userName: ticket.assignedEmployeeName,
                assignedEmployeeName: ticket.assignedEmployeeName,
                timestamp: ticket.updatedAt,
            });
        }
        for (const activity of activityRows) {
            events.push({
                id: activity.id,
                type: activity.eventType,
                eventType: activity.eventType,
                title: activity.title,
                description: activity.description,
                actorName: activity.actorName,
                actorRole: activity.actorRole,
                toEmployeeName: activity.toEmployeeName,
                timestamp: activity.timestamp,
            });
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
            });
            if (transfer.reviewedAt) {
                events.push({
                    type: 'transfer_reviewed',
                    title: transfer.status === 'approved'
                        ? 'Transfer approved'
                        : 'Transfer rejected',
                    userId: transfer.reviewedByUserId,
                    userName: transfer.reviewedByName,
                    status: transfer.status,
                    reviewComment: transfer.reviewComment,
                    fromDepartmentName: transfer.fromDepartmentName,
                    toDepartmentName: transfer.toDepartmentName,
                    timestamp: transfer.reviewedAt,
                });
            }
        }
        events.sort((a, b) => {
            const timeDifference = new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime();
            if (timeDifference !== 0)
                return timeDifference;
            const aId = Number(a.id ?? 0);
            const bId = Number(b.id ?? 0);
            return aId - bId;
        });
        res.status(200).json({
            success: true,
            ticket,
            events,
        });
    }
    catch (error) {
        console.error('Get ticket lifecycle error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to load the ticket lifecycle.',
        });
    }
}
