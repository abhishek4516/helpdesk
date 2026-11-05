"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const db_js_1 = require("./db.js");
async function createNotification(input) {
    try {
        await (0, db_js_1.execute)(`INSERT INTO notifications
       (recipient_user_id, ticket_id, notification_type, title, message)
       VALUES (?, ?, ?, ?, ?)`, [
            input.recipientUserId,
            input.ticketId ?? null,
            input.type,
            input.title,
            input.message,
        ]);
    }
    catch (error) {
        // Notification failure must not undo a successful ticket operation.
        console.error('Create notification error:', error);
    }
}
