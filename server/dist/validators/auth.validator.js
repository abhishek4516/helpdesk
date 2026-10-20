"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z
        .string()
        .trim()
        .min(1, 'Employee ID or email is required')
        .max(254, 'Identifier is too long'),
    password: zod_1.z
        .string()
        .min(1, 'Password is required')
        .max(128, 'Password is too long'),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z
        .string()
        .min(1, 'Current password is required')
        .max(128, 'Password is too long'),
    newPassword: zod_1.z
        .string()
        .min(12, 'New password must be at least 12 characters')
        .max(128, 'New password must not exceed 128 characters'),
});
