import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notifications.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getNotifications)
router.patch('/read-all', markAllNotificationsRead)
router.patch('/:id/read', markNotificationRead)

export default router