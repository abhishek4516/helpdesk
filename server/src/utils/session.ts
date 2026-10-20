
import { randomBytes, createHash } from 'node:crypto'

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
