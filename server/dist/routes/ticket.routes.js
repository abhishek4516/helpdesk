"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const ticket_controller_js_1 = require("../controllers/ticket.controller.js");
const ticketTransfer_controller_js_1 = require("../controllers/ticketTransfer.controller.js");
const router = (0, express_1.Router)();
router.get('/departments', auth_middleware_js_1.requireAuth, ticket_controller_js_1.getDepartments);
router.get('/', auth_middleware_js_1.requireAuth, ticket_controller_js_1.getTickets);
router.post('/', auth_middleware_js_1.requireAuth, ticket_controller_js_1.createTicket);
router.patch('/:id/assign', auth_middleware_js_1.requireAuth, ticket_controller_js_1.assignTicket);
// Transfer workflow
router.post('/:id/transfer-requests', auth_middleware_js_1.requireAuth, ticketTransfer_controller_js_1.requestTicketTransfer);
router.get('/transfer-requests', auth_middleware_js_1.requireAuth, ticketTransfer_controller_js_1.getTicketTransferRequests);
router.patch('/transfer-requests/:id/review', auth_middleware_js_1.requireAuth, ticketTransfer_controller_js_1.reviewTicketTransfer);
exports.default = router;
