"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicketSchema = void 0;
const zod_1 = require("zod");
exports.createTicketSchema = zod_1.z.object({
    title: zod_1.z
        .string()
        .trim()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title cannot exceed 200 characters'),
    description: zod_1.z
        .string()
        .trim()
        .min(10, 'Description must be at least 10 characters')
        .max(10000, 'Description cannot exceed 10000 characters'),
    departmentId: zod_1.z
        .number()
        .int('Department ID must be a whole number')
        .positive('Please select a valid department'),
    priority: zod_1.z.enum(['Low', 'Medium', 'High', 'Critical']),
});
