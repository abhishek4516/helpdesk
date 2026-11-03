
import { z } from 'zod'

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),

  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description cannot exceed 10000 characters'),

  departmentId: z
    .number()
    .int('Department ID must be a whole number')
    .positive('Please select a valid department'),

  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
