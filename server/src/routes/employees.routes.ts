import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireMaster } from '../middleware/requireMaster.js'
import {
  listEmployees,
  listAssignableEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  resetEmployeePassword,
} from '../controllers/employees.controller.js'

const router = Router()

// Authenticated users can access the restricted assignment list.
router.get('/assignable', requireAuth, listAssignableEmployees)

// All employee-management endpoints remain master-only.
router.use(requireAuth, requireMaster)

router.get('/', listEmployees)
router.post('/', createEmployee)
router.put('/:id', updateEmployee)
router.patch('/:id/deactivate', deactivateEmployee)
router.post('/:id/reset-password', resetEmployeePassword)

export default router