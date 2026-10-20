"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const db_js_1 = require("../utils/db.js");
const session_js_1 = require("../utils/session.js");
async function requireAuth(req, res, next) {
    const token = req.cookies?.helpdesk_session;
    if (typeof token !== 'string' || token.length !== 64) {
        return res.status(401).json({
            success: false,
            message: 'Please log in to continue.',
        });
    }
    try {
        const users = await (0, db_js_1.query)(`SELECT u.id, u.employee_id, u.full_name, u.role,
              u.department_id, u.is_active, u.must_change_password
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.session_token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`, [(0, session_js_1.hashSessionToken)(token)]);
        const user = users[0];
        if (!user || !user.is_active) {
            res.clearCookie('helpdesk_session', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
            return res.status(401).json({
                success: false,
                message: 'Your session is invalid or expired. Please log in again.',
            });
        }
        req.user = {
            id: user.id,
            employeeId: user.employee_id,
            name: user.full_name,
            role: user.role,
            departmentId: user.department_id,
            mustChangePassword: Boolean(user.must_change_password),
        };
        return next();
    }
    catch (error) {
        console.error('Session verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to verify your session.',
        });
    }
}
