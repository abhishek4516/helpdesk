
import argon2 from 'argon2'

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  })
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
//     console.log('Hash starts correctly:', passwordHash.startsWith('$'))
// console.log('Hash length:', passwordHash.length)
  return argon2.verify(passwordHash, password)
}
