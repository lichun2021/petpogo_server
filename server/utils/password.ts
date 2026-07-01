import crypto from 'node:crypto'

const KEY_LEN = 64

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, KEY_LEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false

  const check = crypto.scryptSync(plain, salt, KEY_LEN).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(check, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
