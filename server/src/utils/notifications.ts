
import { execute } from './db.js'

interface CreateNotificationInput {
  recipientUserId: number
  ticketId?: number | null
  type: string
  title: string
  message: string
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await execute(
      `INSERT INTO notifications
       (recipient_user_id, ticket_id, notification_type, title, message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.recipientUserId,
        input.ticketId ?? null,
        input.type,
        input.title,
        input.message,
      ],
    )
  } catch (error) {
    // Notification failure must not undo a successful ticket operation.
    console.error('Create notification error:', error)
  }
}
