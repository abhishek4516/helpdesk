"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.changePassword = changePassword;
exports.logout = logout;
exports.getCurrentUser = getCurrentUser;
const db_js_1 = require("../utils/db.js");
const password_js_1 = require("../utils/password.js");
const auth_validator_js_1 = require("../validators/auth.validator.js");
const session_js_1 = require("../utils/session.js");
async function login(req, res) {
    const parsed = auth_validator_js_1.loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid Employee ID or email and password.',
        });
    }
    try {
        const { identifier, password } = parsed.data;
        const users = await (0, db_js_1.query)(`SELECT id, employee_id, email, full_name, password_hash,
              role, department_id, is_active, must_change_password
       FROM users
       WHERE employee_id = ? OR email = ?
       LIMIT 1`, [identifier, identifier]);
        const user = users[0];
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or inactive account.',
            });
        }
        const passwordMatches = await (0, password_js_1.verifyPassword)(user.password_hash, password);
        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or inactive account.',
            });
        }
        const token = (0, session_js_1.createSessionToken)();
        const tokenHash = (0, session_js_1.hashSessionToken)(token);
        const expiresAt = new Date(Date.now() + session_js_1.SESSION_DURATION_MS);
        await (0, db_js_1.execute)(`INSERT INTO user_sessions (user_id, session_token_hash, expires_at)
       VALUES (?, ?, ?)`, [user.id, tokenHash, expiresAt]);
        res.cookie('helpdesk_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: session_js_1.SESSION_DURATION_MS,
        });
        return res.json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user.id,
                employeeId: user.employee_id,
                name: user.full_name,
                role: user.role,
                departmentId: user.department_id,
                mustChangePassword: Boolean(user.must_change_password),
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected server error occurred.',
        });
    }
}
async function changePassword(req, res) {
    const parsed = auth_validator_js_1.changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: 'Please provide your current password and a valid new password.',
        });
    }
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Please log in to continue.',
        });
    }
    try {
        const { currentPassword, newPassword } = parsed.data;
        const users = await (0, db_js_1.query)(`SELECT id, employee_id, email, full_name, password_hash,
              role, department_id, is_active, must_change_password
       FROM users
       WHERE id = ?
       LIMIT 1`, [req.user.id]);
        const user = users[0];
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User account not found or inactive.',
            });
        }
        const passwordMatches = await (0, password_js_1.verifyPassword)(user.password_hash, currentPassword);
        if (!passwordMatches) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.',
            });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Your new password must differ from your current password.',
            });
        }
        const newPasswordHash = await (0, password_js_1.hashPassword)(newPassword);
        await (0, db_js_1.execute)(`UPDATE users
       SET password_hash = ?, must_change_password = FALSE
       WHERE id = ?`, [newPasswordHash, user.id]);
        // Invalidate all existing sessions after a password change.
        await (0, db_js_1.execute)('DELETE FROM user_sessions WHERE user_id = ?', [user.id]);
        res.clearCookie('helpdesk_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });
        return res.json({
            success: true,
            message: 'Password changed successfully. Please log in again.',
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to change password. Please try again.',
        });
    }
}
async function logout(req, res) {
    const token = req.cookies?.helpdesk_session;
    try {
        if (typeof token === 'string' && token.length === 64) {
            await (0, db_js_1.execute)('DELETE FROM user_sessions WHERE session_token_hash = ?', [(0, session_js_1.hashSessionToken)(token)]);
        }
        res.clearCookie('helpdesk_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });
        return res.json({
            success: true,
            message: 'Logged out successfully.',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to log out. Please try again.',
        });
    }
}
function getCurrentUser(req, res) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Please log in to continue.',
        });
    }
    return res.json({
        success: true,
        user: req.user,
    });
}
