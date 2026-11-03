
import { Router } from 'express'

import { requireAuth } from '../middleware/auth.middleware.js'
import { requireMaster } from '../middleware/requireMaster.js'

import {
  listDepartments,
  createDepartment,
  updateDepartment,
  assignDepartmentHead,
  removeDepartmentHead,
  setDepartmentActiveStatus,
} from '../controllers/departments.controller.js'

const router = Router()

// All department routes require authentication.
router.use(requireAuth)

// Department listing is available to authenticated users.
router.get('/', listDepartments)

// Department management is Master Admin only.
router.use(requireMaster)

router.post('/', createDepartment)
router.put('/:id', updateDepartment)

router.patch('/:id/head', assignDepartmentHead)
router.delete('/:id/head', removeDepartmentHead)

router.patch('/:id/status', setDepartmentActiveStatus)

export default router
