"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEmployees = listEmployees;
exports.listAssignableEmployees = listAssignableEmployees;
exports.createEmployee = createEmployee;
exports.updateEmployee = updateEmployee;
exports.deactivateEmployee = deactivateEmployee;
exports.resetEmployeePassword = resetEmployeePassword;
const node_crypto_1 = require("node:crypto");
const db_js_1 = require("../utils/db.js");
const password_js_1 = require("../utils/password.js");
const temporaryPasswordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
function generateTemporaryPassword() {
    return Array.from({ length: 16 }, () => temporaryPasswordAlphabet[(0, node_crypto_1.randomInt)(temporaryPasswordAlphabet.length)]).join('');
}
function parsePositiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function parseRole(value) {
    if (value === 'master' ||
        value === 'department_head' ||
        value === 'employee') {
        return value;
    }
    return null;
}
function parseDepartmentId(value) {
    if (value === null || value === '')
        return null;
    if (value === undefined)
        return undefined;
    return parsePositiveId(value) ?? undefined;
}
function publicEmployee(employee) {
    return {
        id: employee.id,
        employeeId: employee.employee_id,
        name: employee.full_name,
        email: employee.email,
        role: employee.role,
        departmentId: employee.department_id,
        isActive: Boolean(employee.is_active),
        mustChangePassword: Boolean(employee.must_change_password),
    };
}
async function departmentExists(departmentId) {
    const departments = await (0, db_js_1.query)(`SELECT id, is_active, head_user_id

     FROM departments

     WHERE id = ? AND is_active = TRUE

     LIMIT 1`, [departmentId]);
    return departments.length > 0;
}
async function invalidateSessions(userId) {
    await (0, db_js_1.execute)('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
}
async function lockDepartment(connection, departmentId) {
    const [rows] = await connection.execute(`SELECT id, is_active, head_user_id

     FROM departments

     WHERE id = ?

     LIMIT 1

     FOR UPDATE`, [departmentId]);
    return rows[0] ?? null;
}
function isDuplicateEntry(error) {
    return error?.code === 'ER_DUP_ENTRY';
}
function errorResponse(res, message, status = 400) {
    return res.status(status).json({
        success: false,
        message,
    });
}
async function listEmployees(_req, res) {
    try {
        const employees = await (0, db_js_1.query)(`SELECT id, employee_id, full_name, email, role,

              department_id, is_active, must_change_password

       FROM users

       ORDER BY full_name ASC`);
        return res.json({
            success: true,
            employees: employees.map(publicEmployee),
        });
    }
    catch (error) {
        console.error('List employees error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load employees.',
        });
    }
}
async function listAssignableEmployees(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return errorResponse(res, 'Please log in to view assignable employees.', 401);
        }
        let employees;
        if (user.role === 'master') {
            employees = await (0, db_js_1.query)(`SELECT id, employee_id, full_name, email, role,

                department_id, is_active, must_change_password

         FROM users

         WHERE is_active = TRUE

           AND role IN ('employee', 'department_head')

         ORDER BY full_name ASC`);
        }
        else if (user.role === 'department_head') {
            employees = await (0, db_js_1.query)(`SELECT u.id, u.employee_id, u.full_name, u.email,

                u.role, u.department_id, u.is_active,

                u.must_change_password

         FROM users u

         INNER JOIN departments d

           ON d.id = u.department_id

         WHERE d.head_user_id = ?

           AND u.role = 'employee'

           AND u.is_active = TRUE

           AND d.is_active = TRUE

         ORDER BY u.full_name ASC`, [user.id]);
        }
        else {
            return errorResponse(res, 'You are not allowed to assign tickets.', 403);
        }
        return res.status(200).json({
            success: true,
            employees: employees.map(publicEmployee),
        });
    }
    catch (error) {
        console.error('List assignable employees error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load assignable employees.',
        });
    }
}
async function createEmployee(req, res) {
    const name = typeof req.body.name === 'string'
        ? req.body.name.trim()
        : '';
    const email = typeof req.body.email === 'string' && req.body.email.trim()
        ? req.body.email.trim().toLowerCase()
        : null;
    const role = parseRole(req.body.role);
    const departmentId = parseDepartmentId(req.body.departmentId);
    if (!name || name.length > 150) {
        return errorResponse(res, 'Name is required and must not exceed 150 characters.');
    }
    if (email !== null &&
        (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return errorResponse(res, 'Please provide a valid email address.');
    }
    if (!role) {
        return errorResponse(res, 'Please select a valid role.');
    }
    if (departmentId === undefined) {
        return errorResponse(res, 'Please select a valid department.');
    }
    if (role !== 'master' && departmentId === null) {
        return errorResponse(res, 'A department is required for this role.');
    }
    if (role === 'master' && departmentId !== null) {
        return errorResponse(res, 'Master users cannot belong to a department.');
    }
    try {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await (0, password_js_1.hashPassword)(temporaryPassword);
        const createdEmployee = await (0, db_js_1.withTransaction)(async (connection) => {
            const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', ['helpdesk_employee_id_sequence']);
            if (Number(lockRows[0]?.acquired) !== 1) {
                throw new Error('Unable to generate an Employee ID right now. Please try again.');
            }
            try {
                const [maxRows] = await connection.execute(`SELECT MAX(CAST(employee_id AS DECIMAL(20, 0))) AS maxEmployeeId
           FROM users
           WHERE employee_id REGEXP '^[0-9]+$'`);
                const maxEmployeeId = maxRows[0]?.maxEmployeeId ?? 0;
                const employeeId = (BigInt(String(maxEmployeeId)) + 1n).toString();
                if (employeeId.length > 20) {
                    throw new Error('The Employee ID sequence has reached its maximum value.');
                }
                if (departmentId !== null) {
                    const department = await lockDepartment(connection, departmentId);
                    if (!department || !department.is_active) {
                        throw new Error('The selected department does not exist or is inactive.');
                    }
                    if (role === 'department_head' &&
                        department.head_user_id !== null) {
                        throw new Error('This department already has a head. Remove or replace the existing head first.');
                    }
                }
                const [result] = await connection.execute(`INSERT INTO users

          (employee_id, full_name, email, password_hash, role,

           department_id, is_active, must_change_password)

         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`, [employeeId, name, email, passwordHash, role, departmentId]);
                const newUserId = result.insertId;
                if (role === 'department_head' && departmentId !== null) {
                    await connection.execute(`UPDATE departments

           SET head_user_id = ?

           WHERE id = ? AND head_user_id IS NULL`, [newUserId, departmentId]);
                }
                return { id: newUserId, employeeId };
            }
            finally {
                await connection.execute('SELECT RELEASE_LOCK(?)', ['helpdesk_employee_id_sequence']);
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Employee created successfully.',
            employee: {
                id: createdEmployee.id,
                employeeId: createdEmployee.employeeId,
                name,
                email,
                role,
                departmentId,
                isActive: true,
                mustChangePassword: true,
            },
            temporaryPassword,
        });
    }
    catch (error) {
        if (isDuplicateEntry(error)) {
            return errorResponse(res, 'That Employee ID or email address is already in use.', 409);
        }
        if (error instanceof Error) {
            if (error.message.includes('department') ||
                error.message.includes('already has a head')) {
                return errorResponse(res, error.message, 409);
            }
        }
        console.error('Create employee error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to create employee.',
        });
    }
}
async function updateEmployee(req, res) {
    const employeeDatabaseId = parsePositiveId(req.params.id);
    if (!employeeDatabaseId) {
        return errorResponse(res, 'Invalid employee record ID.');
    }
    const employeeId = typeof req.body.employeeId === 'string'
        ? req.body.employeeId.trim()
        : '';
    const name = typeof req.body.name === 'string'
        ? req.body.name.trim()
        : '';
    const email = typeof req.body.email === 'string' && req.body.email.trim()
        ? req.body.email.trim().toLowerCase()
        : null;
    const role = parseRole(req.body.role);
    const departmentId = parseDepartmentId(req.body.departmentId);
    if (!/^\d{1,20}$/.test(employeeId)) {
        return errorResponse(res, 'Employee ID must contain 1 to 20 digits.');
    }
    if (!name || name.length > 150) {
        return errorResponse(res, 'Name is required and must not exceed 150 characters.');
    }
    if (email !== null &&
        (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return errorResponse(res, 'Please provide a valid email address.');
    }
    if (!role) {
        return errorResponse(res, 'Please select a valid role.');
    }
    if (departmentId === undefined) {
        return errorResponse(res, 'Please select a valid department.');
    }
    if (role !== 'master' && departmentId === null) {
        return errorResponse(res, 'A department is required for this role.');
    }
    if (role === 'master' && departmentId !== null) {
        return errorResponse(res, 'Master users cannot belong to a department.');
    }
    if (employeeDatabaseId === req.user?.id) {
        return errorResponse(res, 'You cannot edit your own account here.');
    }
    try {
        await (0, db_js_1.withTransaction)(async (connection) => {
            const [existingRows] = await connection.execute(`SELECT id, employee_id, full_name, email, role,

                department_id, is_active, must_change_password

         FROM users

         WHERE id = ?

         LIMIT 1

         FOR UPDATE`, [employeeDatabaseId]);
            const existing = existingRows[0];
            if (!existing) {
                throw new Error('EMPLOYEE_NOT_FOUND');
            }
            if (!existing.is_active) {
                throw new Error('This employee account is inactive.');
            }
            if (departmentId !== null) {
                const department = await lockDepartment(connection, departmentId);
                if (!department || !department.is_active) {
                    throw new Error('The selected department does not exist or is inactive.');
                }
                if (role === 'department_head' &&
                    department.head_user_id !== null &&
                    department.head_user_id !== employeeDatabaseId) {
                    throw new Error('This department already has a head. Remove or replace the existing head first.');
                }
            }
            // Clear the old head assignment when moving or demoting a head.
            if (existing.role === 'department_head' &&
                existing.department_id !== null &&
                (role !== 'department_head' ||
                    departmentId !== existing.department_id)) {
                await connection.execute(`UPDATE departments

           SET head_user_id = NULL

           WHERE id = ? AND head_user_id = ?`, [existing.department_id, employeeDatabaseId]);
            }
            await connection.execute(`UPDATE users

         SET employee_id = ?,

             full_name = ?,

             email = ?,

             role = ?,

             department_id = ?

         WHERE id = ?`, [employeeId, name, email, role, departmentId, employeeDatabaseId]);
            // Assign the employee as head of the new department.
            if (role === 'department_head' && departmentId !== null) {
                const [result] = await connection.execute(`UPDATE departments

           SET head_user_id = ?

           WHERE id = ?

             AND (head_user_id IS NULL OR head_user_id = ?)`, [employeeDatabaseId, departmentId, employeeDatabaseId]);
                if (result.affectedRows === 0) {
                    throw new Error('This department already has a head. Remove or replace the existing head first.');
                }
            }
        });
        await invalidateSessions(employeeDatabaseId);
        const updated = await (0, db_js_1.query)(`SELECT id, employee_id, full_name, email, role,

              department_id, is_active, must_change_password

       FROM users

       WHERE id = ?

       LIMIT 1`, [employeeDatabaseId]);
        if (!updated[0]) {
            return errorResponse(res, 'Employee not found.', 404);
        }
        return res.json({
            success: true,
            message: 'Employee details updated. They must log in again.',
            employee: publicEmployee(updated[0]),
        });
    }
    catch (error) {
        if (isDuplicateEntry(error)) {
            return errorResponse(res, 'That Employee ID or email address is already in use.', 409);
        }
        if (error instanceof Error) {
            if (error.message === 'EMPLOYEE_NOT_FOUND') {
                return errorResponse(res, 'Employee not found.', 404);
            }
            if (error.message.includes('department') ||
                error.message.includes('head')) {
                return errorResponse(res, error.message, 409);
            }
            if (error.message.includes('inactive')) {
                return errorResponse(res, error.message, 409);
            }
        }
        console.error('Update employee error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to update employee.',
        });
    }
}
async function deactivateEmployee(req, res) {
    const employeeDatabaseId = parsePositiveId(req.params.id);
    if (!employeeDatabaseId) {
        return errorResponse(res, 'Invalid employee record ID.');
    }
    if (employeeDatabaseId === req.user?.id) {
        return errorResponse(res, 'You cannot deactivate your own account.');
    }
    try {
        const deactivated = await (0, db_js_1.withTransaction)(async (connection) => {
            const [employees] = await connection.execute(`SELECT id, employee_id, full_name, email, role,

                department_id, is_active, must_change_password

         FROM users

         WHERE id = ?

         LIMIT 1

         FOR UPDATE`, [employeeDatabaseId]);
            const employee = employees[0];
            if (!employee || !employee.is_active) {
                return false;
            }
            if (employee.role === 'department_head' &&
                employee.department_id !== null) {
                await connection.execute(`UPDATE departments

           SET head_user_id = NULL

           WHERE id = ? AND head_user_id = ?`, [employee.department_id, employeeDatabaseId]);
            }
            await connection.execute(`UPDATE users

         SET is_active = FALSE

         WHERE id = ?`, [employeeDatabaseId]);
            return true;
        });
        if (!deactivated) {
            return errorResponse(res, 'Active employee not found.', 404);
        }
        await invalidateSessions(employeeDatabaseId);
        return res.json({
            success: true,
            message: 'Employee account deactivated. Ticket history is preserved.',
        });
    }
    catch (error) {
        console.error('Deactivate employee error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to deactivate employee.',
        });
    }
}
async function resetEmployeePassword(req, res) {
    const employeeDatabaseId = parsePositiveId(req.params.id);
    if (!employeeDatabaseId) {
        return errorResponse(res, 'Invalid employee record ID.');
    }
    if (employeeDatabaseId === req.user?.id) {
        return errorResponse(res, 'Use the regular password-change process for your own account.');
    }
    try {
        const employees = await (0, db_js_1.query)(`SELECT id, employee_id, full_name, email, role,

              department_id, is_active, must_change_password

       FROM users

       WHERE id = ? AND is_active = TRUE

       LIMIT 1`, [employeeDatabaseId]);
        if (!employees[0]) {
            return errorResponse(res, 'Active employee not found.', 404);
        }
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await (0, password_js_1.hashPassword)(temporaryPassword);
        await (0, db_js_1.execute)(`UPDATE users

       SET password_hash = ?, must_change_password = TRUE

       WHERE id = ?`, [passwordHash, employeeDatabaseId]);
        await invalidateSessions(employeeDatabaseId);
        return res.json({
            success: true,
            message: 'Temporary password generated. The employee must change it at next login.',
            employeeId: employees[0].employee_id,
            temporaryPassword,
        });
    }
    catch (error) {
        console.error('Reset employee password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to reset employee password.',
        });
    }
}
