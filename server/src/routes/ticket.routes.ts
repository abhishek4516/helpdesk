
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  createTicket,
  getDepartments,
  getTickets,
  assignTicket,
} from '../controllers/ticket.controller.js'

const router = Router()

// Department list
router.get('/departments', requireAuth, getDepartments)

// View tickets
router.get('/', requireAuth, getTickets)

// Create a ticket
router.post('/', requireAuth, createTicket)

// Assign or reassign a ticket
router.patch('/:id/assign', requireAuth, assignTicket)

export default router
