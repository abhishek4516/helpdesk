"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markNotificationRead = markNotificationRead;
exports.markAllNotificationsRead = markAllNotificationsRead;
const db_js_1 = require("../utils/db.js");
async function getNotifications(req, res) {
    try {
        const userId = req.user.id;
        const notifications = await (0, db_js_1.query)(`SELECT
          n.id,
          n.recipient_user_id,
          n.ticket_id,
          n.notification_type,
          n.title,
          n.message,
          n.is_read,
          n.read_at,
          n.created_at,
          t.ticket_code
       FROM notifications n
       LEFT JOIN tickets t ON t.id = n.ticket_id
       WHERE n.recipient_user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`, [userId]);
        const unreadResult = await (0, db_js_1.query)(`SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE recipient_user_id = ?
         AND is_read = 0`, [userId]);
        return res.json({
            success: true,
            notifications,
            unreadCount: Number(unreadResult[0]?.unread_count ?? 0),
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load notifications.',
        });
    }
}
async function markNotificationRead(req, res) {
    try {
        const userId = req.user.id;
        const notificationId = Number(req.params.id);
        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID.',
            });
        }
        const result = await (0, db_js_1.execute)(`UPDATE notifications
       SET is_read = 1,
           read_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND recipient_user_id = ?
         AND is_read = 0`, [notificationId, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found or already read.',
            });
        }
        return res.json({
            success: true,
            message: 'Notification marked as read.',
        });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to update notification.',
        });
    }
}
async function markAllNotificationsRead(req, res) {
    try {
        const userId = req.user.id;
        await (0, db_js_1.execute)(`UPDATE notifications
       SET is_read = 1,
           read_at = CURRENT_TIMESTAMP
       WHERE recipient_user_id = ?
         AND is_read = 0`, [userId]);
        return res.json({
            success: true,
            message: 'All notifications marked as read.',
        });
    }
    catch (error) {
        console.error('Mark all notifications read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to update notifications.',
        });
    }
}
