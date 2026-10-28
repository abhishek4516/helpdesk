
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  createTicket,
  getDepartments,
  getTickets,
  assignTicket,
  getTicketLifecycle,
} from '../controllers/ticket.controller.js'
import {
  requestTicketTransfer,
  getTicketTransferRequests,
  reviewTicketTransfer,
} from '../controllers/ticketTransfer.controller.js'

const router = Router()

router.get('/departments', requireAuth, getDepartments)
router.get('/', requireAuth, getTickets)
router.get('/:id/lifecycle', requireAuth, getTicketLifecycle)
router.post('/', requireAuth, createTicket)

router.patch('/:id/assign', requireAuth, assignTicket)

// Transfer workflow
router.post('/:id/transfer-requests', requireAuth, requestTicketTransfer)
router.get('/transfer-requests', requireAuth, getTicketTransferRequests)
router.patch('/transfer-requests/:id/review', requireAuth, reviewTicketTransfer)

export default router
