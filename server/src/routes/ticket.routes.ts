
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  createTicket,
  getDepartments,
  getTickets,
} from '../controllers/ticket.controller.js'

const router = Router()

router.get('/departments', requireAuth, getDepartments)
router.get('/', requireAuth, getTickets)
router.post('/', requireAuth, createTicket)

export default router
