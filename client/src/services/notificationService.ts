const API_BASE_URL = "http://localhost:5000/api";

export interface NotificationItem {
  id: number;
  ticket_id: number | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: number | boolean;
  read_at: string | null;
  created_at: string;
  ticket_code: string | null;
}

interface NotificationsResponse {
  success: boolean;
  message?: string;
  notifications?: NotificationItem[];
  unreadCount?: number;
}

interface ActionResponse {
  success: boolean;
  message?: string;
}

export interface NotificationsData {
  notifications: NotificationItem[];
  unreadCount: number;
}

export async function getNotifications(): Promise<NotificationsData> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    credentials: "include",
  });

  const data = (await response.json()) as NotificationsResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load notifications.");
  }

  return {
    notifications: data.notifications ?? [],
    unreadCount: Number(data.unreadCount ?? 0),
  };
}

export async function markNotificationRead(
  notificationId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = (await response.json()) as ActionResponse;

  // Already-read notifications may return 404 from the current backend.
  if (!response.ok && response.status !== 404) {
    throw new Error(data.message || "Unable to mark notification as read.");
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    credentials: "include",
  });

  const data = (await response.json()) as ActionResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to update notifications.");
  }
}