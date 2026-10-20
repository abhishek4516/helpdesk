"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartments = getDepartments;
exports.createTicket = createTicket;
exports.getTickets = getTickets;
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
        res.status(200).json({
            success: true,
            departments,
        });
    }
    catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to load departments.',
        });
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
            res.status(401).json({
                success: false,
                message: 'Please log in to create a ticket.',
            });
            return;
        }
        const [departments] = await database_js_1.pool.execute(`SELECT id, name, department_code AS departmentCode
       FROM departments
       WHERE id = ? AND is_active = 1
       LIMIT 1`, [departmentId]);
        if (departments.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Please select an active department.',
            });
            return;
        }
        const ticketCode = `HD-${(0, node_crypto_1.randomBytes)(6).toString('hex').toUpperCase()}`;
        const [result] = await database_js_1.pool.execute(`INSERT INTO tickets
        (ticket_code, title, description, requester_user_id, department_id, status)
       VALUES (?, ?, ?, ?, ?, 'open')`, [ticketCode, title, description, user.id, departmentId]);
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
        res.status(500).json({
            success: false,
            message: 'Unable to create the ticket. Please try again.',
        });
    }
}
async function getTickets(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Please log in to view tickets.',
            });
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
        u.name AS requesterName,
        t.assigned_employee_id AS assignedEmployeeId,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM tickets t
      INNER JOIN departments d ON d.id = t.department_id
      INNER JOIN users u ON u.id = t.requester_user_id
    `;
        const params = [];
        if (user.role === 'master') {
            // Master users can view all tickets.
        }
        else if (user.role === 'department_head') {
            sql += ' WHERE d.head_user_id = ?';
            params.push(user.id);
        }
        else {
            sql += ' WHERE t.requester_user_id = ?';
            params.push(user.id);
        }
        sql += ' ORDER BY t.created_at DESC';
        const [tickets] = await database_js_1.pool.execute(sql, params);
        res.status(200).json({
            success: true,
            tickets,
        });
    }
    catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to load tickets.',
        });
    }
}
