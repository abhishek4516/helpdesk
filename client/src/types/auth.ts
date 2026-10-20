
export type UserRole = 'master' | 'department_head' | 'employee'

export interface LoggedInUser {
  id: number
  employeeId: string
  name: string
  role: UserRole
  departmentId: number | null
  mustChangePassword: boolean
}

export interface LoginResponse {
  success: boolean
  message: string
  user?: LoggedInUser
}

export interface ApiResponse {
  success: boolean
  message: string
}

