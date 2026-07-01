import type { H3Event } from 'h3'
import crypto from 'node:crypto'

export interface AdminSession {
  adminId: string
  username: string
  role: 'super_admin' | 'admin'
}

// 与 signJwt 的 6h 过期时间保持一致
export const ADMIN_SESSION_TTL = 6 * 60 * 60

/** token 只在 Redis 里存哈希，不存明文 */
export function hashAdminToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** 要求当前请求的管理员是超级管理员，否则 403（依赖 server/middleware/admin-auth.ts 注入的 event.context.admin） */
export function requireSuperAdmin(event: H3Event): AdminSession {
  const admin = event.context.admin as AdminSession | undefined
  if (!admin || admin.role !== 'super_admin') {
    throw createError({ statusCode: 403, message: '仅超级管理员可执行此操作' })
  }
  return admin
}
