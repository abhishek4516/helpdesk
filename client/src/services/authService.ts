
import type { ApiResponse, LoggedInUser, LoginResponse } from '../types/auth'

const API_BASE_URL = 'http://localhost:5000/api'

async function readResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

export async function login(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
    }),
  })

  return readResponse<LoginResponse>(response)
}

export async function logout(): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  return readResponse<ApiResponse>(response)
}

export async function getCurrentUser(): Promise<LoggedInUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error('Unable to verify your login session.')
  }

  const data = await readResponse<{
    success: boolean
    user?: LoggedInUser
  }>(response)

  return data.success && data.user ? data.user : null
}
