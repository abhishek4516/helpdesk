"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const requireMaster_js_1 = require("../middleware/requireMaster.js");
const employees_controller_js_1 = require("../controllers/employees.controller.js");
const router = (0, express_1.Router)();
// Every employee-management endpoint requires an authenticated master user.
router.use(auth_middleware_js_1.requireAuth, requireMaster_js_1.requireMaster);
router.get('/', employees_controller_js_1.listEmployees);
router.post('/', employees_controller_js_1.createEmployee);
router.put('/:id', employees_controller_js_1.updateEmployee);
router.patch('/:id/deactivate', employees_controller_js_1.deactivateEmployee);
router.post('/:id/reset-password', employees_controller_js_1.resetEmployeePassword);
exports.default = router;
