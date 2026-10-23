"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const ticket_controller_js_1 = require("../controllers/ticket.controller.js");
const router = (0, express_1.Router)();
// Department list
router.get('/departments', auth_middleware_js_1.requireAuth, ticket_controller_js_1.getDepartments);
// View tickets
router.get('/', auth_middleware_js_1.requireAuth, ticket_controller_js_1.getTickets);
// Create a ticket
router.post('/', auth_middleware_js_1.requireAuth, ticket_controller_js_1.createTicket);
// Assign or reassign a ticket
router.patch('/:id/assign', auth_middleware_js_1.requireAuth, ticket_controller_js_1.assignTicket);
exports.default = router;
