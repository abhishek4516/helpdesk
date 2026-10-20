
import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Employee ID or email is required')
    .max(254, 'Identifier is too long'),

  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
})

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required')
    .max(128, 'Password is too long'),

  newPassword: z
    .string()
    .min(12, 'New password must be at least 12 characters')
    .max(128, 'New password must not exceed 128 characters'),
})
