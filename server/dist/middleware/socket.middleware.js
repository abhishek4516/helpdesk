"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSocket = authenticateSocket;
const node_querystring_1 = require("node:querystring");
const db_js_1 = require("../utils/db.js");
const session_js_1 = require("../utils/session.js");
async function authenticateSocket(socket, next) {
    try {
        const cookieHeader = socket.handshake.headers.cookie;
        if (!cookieHeader) {
            return next(new Error('Authentication required.'));
        }
        const cookies = (0, node_querystring_1.parse)(cookieHeader.split(';').join('&'));
        const token = cookies.helpdesk_session;
        if (typeof token !== 'string' || token.length !== 64) {
            return next(new Error('Invalid session.'));
        }
        const users = await (0, db_js_1.query)(`SELECT
          u.id,
          u.employee_id,
          u.full_name,
          u.role,
          u.department_id,
          d.name AS department_name,
          u.is_active,
          u.must_change_password
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE s.session_token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`, [(0, session_js_1.hashSessionToken)(token)]);
        const user = users[0];
        if (!user || !user.is_active) {
            return next(new Error('Session invalid or expired.'));
        }
        socket.data.user = {
            id: user.id,
            employeeId: user.employee_id,
            name: user.full_name,
            role: user.role,
            departmentId: user.department_id,
            departmentName: user.department_name,
            mustChangePassword: Boolean(user.must_change_password),
        };
        return next();
    }
    catch (error) {
        console.error('Socket authentication error:', error);
        return next(new Error('Unable to authenticate socket connection.'));
    }
}
