
const API_BASE_URL = "http://localhost:5000/api";

export interface TicketLifecycleEvent {
  type: string;
  title: string;
  description?: string;
  userId?: number | null;
  userName?: string | null;
  userRole?: string;
  fromDepartmentName?: string;
  toDepartmentName?: string;
  reason?: string;
  status?: string;
  reviewComment?: string | null;
  timestamp: string;
}

export interface TicketLifecycle {
  success: boolean;
  ticket: {
    id: number;
    ticketCode: string;
    title: string;
    status: string;
    requesterName: string;
    departmentName: string;
  };
  events: TicketLifecycleEvent[];
}

export async function getTicketLifecycle(
  ticketId: number,
): Promise<TicketLifecycle> {
  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/lifecycle`,
    {
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Unable to load ticket lifecycle.",
    );
  }

  return data as TicketLifecycle;
}
