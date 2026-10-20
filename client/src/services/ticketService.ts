
const API_BASE_URL = 'http://localhost:5000/api'

export interface Department {
  id: number
  name: string
  departmentCode: string
}

export interface Ticket {
  id: number
  ticketCode: string
  title: string
  description: string
  status: string
  departmentId: number
  departmentName: string
  requesterUserId: number
  requesterName?: string
  assignedEmployeeId?: number | null
  createdAt: string
  updatedAt: string
}

interface DepartmentsResponse {
  success: boolean
  message?: string
  departments?: Department[]
}

interface TicketsResponse {
  success: boolean
  message?: string
  tickets?: Ticket[]
}

interface CreateTicketResponse {
  success: boolean
  message: string
  ticket?: Ticket
}

async function readResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

export async function getDepartments(): Promise<Department[]> {
  const response = await fetch(`${API_BASE_URL}/tickets/departments`, {
    credentials: 'include',
  })

  const data = await readResponse<DepartmentsResponse>(response)

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to load departments.')
  }

  return data.departments ?? []
}

export async function getTickets(): Promise<Ticket[]> {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    credentials: 'include',
  })

  const data = await readResponse<TicketsResponse>(response)

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to load tickets.')
  }

  return data.tickets ?? []
}

export async function createTicket(input: {
  title: string
  description: string
  departmentId: number
}): Promise<Ticket> {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  const data = await readResponse<CreateTicketResponse>(response)

  if (!response.ok || !data.success || !data.ticket) {
    throw new Error(data.message || 'Unable to create ticket.')
  }

  return data.ticket
}
