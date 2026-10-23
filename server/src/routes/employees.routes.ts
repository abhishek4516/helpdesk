
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireMaster } from '../middleware/requireMaster.js'
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  resetEmployeePassword,
} from '../controllers/employees.controller.js'

const router = Router()

// Every employee-management endpoint requires an authenticated master user.
router.use(requireAuth, requireMaster)

router.get('/', listEmployees)
router.post('/', createEmployee)
router.put('/:id', updateEmployee)
router.patch('/:id/deactivate', deactivateEmployee)
router.post('/:id/reset-password', resetEmployeePassword)

export default router
