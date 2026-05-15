import type { H3Event } from 'h3'
import { tokenSessionKey } from './peerBackend'

export interface SessionUser {
  userId: string
  phone: string
  role?: string
}

/**
 * requireAuth
 * ──────────────────────────────────────────────────────────────
 * 验证 App 请求的合法性。
 *
 * 流程：
 *  1. 从 Authorization 头提取 Bearer Token（即对方后台颁发的 Token）
 *  2. 用 Token 的 SHA-256 哈希在 Redis 中查询对应的用户 Session
 *  3. Session 不存在 → Token 过期或未登录
 *  4. 将用户信息注入 event.context.user，供后续 handler 使用
 *
 * 注意：我们不再自签 JWT，Token 完全由对方后台颁发和管理。
 *       本后台通过 Redis 缓存 Token → 用户信息 的映射来快速鉴权。
 * ──────────────────────────────────────────────────────────────
 */
export async function requireAuth(event: H3Event): Promise<SessionUser> {
  const authHeader = getHeader(event, 'Authorization') || getHeader(event, 'authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  // 从 Redis 查询 Token 对应的 Session（登录时写入，刷新 Token 时更新）
  const redis = useRedis()
  const sessionKey = tokenSessionKey(token)
  const raw = await redis.get(sessionKey)

  if (!raw) {
    throw createError({ statusCode: 401, message: 'Token 已过期，请重新登录' })
  }

  let user: SessionUser
  try {
    user = JSON.parse(raw) as SessionUser
  } catch {
    throw createError({ statusCode: 401, message: 'Session 数据异常，请重新登录' })
  }

  // 校验用户是否存在且未被封号（本后台 DB 二次校验）
  const db = useDb()
  const [[dbUser]]: any = await db.query(
    'SELECT id, status FROM t_user WHERE id=? AND deleted=0 LIMIT 1',
    [user.userId]
  )

  if (!dbUser) {
    throw createError({ statusCode: 403, message: '账号不存在' })
  }
  if (dbUser.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被封禁，无法执行此操作' })
  }

  // 用 DB 中的精确 ID 覆盖（防止 Snowflake ID 精度问题）
  const accurateUser: SessionUser = { ...user, userId: String(dbUser.id) }
  event.context.user = accurateUser
  return accurateUser
}
