
import { Router } from 'express'
import {
  login,
  logout,
  getCurrentUser,
  changePassword,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.post('/login', login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, getCurrentUser)
router.post('/change-password', requireAuth, changePassword)

export default router
