"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const requireMaster_js_1 = require("../middleware/requireMaster.js");
const departments_controller_js_1 = require("../controllers/departments.controller.js");
const router = (0, express_1.Router)();
// All department routes require authentication.
router.use(auth_middleware_js_1.requireAuth);
// Department listing is available to authenticated users.
router.get('/', departments_controller_js_1.listDepartments);
// Department management is Master Admin only.
router.use(requireMaster_js_1.requireMaster);
router.post('/', departments_controller_js_1.createDepartment);
router.put('/:id', departments_controller_js_1.updateDepartment);
router.patch('/:id/head', departments_controller_js_1.assignDepartmentHead);
router.delete('/:id/head', departments_controller_js_1.removeDepartmentHead);
router.patch('/:id/status', departments_controller_js_1.setDepartmentActiveStatus);
exports.default = router;
