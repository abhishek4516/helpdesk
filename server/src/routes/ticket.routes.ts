
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  createTicket,
  getDepartments,
  getTickets,
  assignTicket,
  // reviewTicket,
  getTicketLifecycle,
} from '../controllers/ticket.controller.js'
import {
  getTicketComments,
  addTicketComment,
  submitTicketResolution,
  reviewTicketResolution,
  reopenTicket,
  changeTicketPriority,
} from '../controllers/ticketWorkflow.controller.js'
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

// router.patch('/:id/review', requireAuth, )
router.patch('/:id/assign', requireAuth, assignTicket)
router.get('/:id/comments', requireAuth, getTicketComments)
router.post('/:id/comments', requireAuth, addTicketComment)
router.post('/:id/resolution', requireAuth, submitTicketResolution)
router.patch('/:id/resolution/:resolutionId/review', requireAuth, reviewTicketResolution)
router.post('/:id/reopen', requireAuth, reopenTicket)
router.patch('/:id/priority', requireAuth, changeTicketPriority)

// Transfer workflow
router.post('/:id/transfer-requests', requireAuth, requestTicketTransfer)
router.get('/transfer-requests', requireAuth, getTicketTransferRequests)
router.patch('/transfer-requests/:id/review', requireAuth, reviewTicketTransfer)

export default router
