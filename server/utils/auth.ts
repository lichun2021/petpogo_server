import type { H3Event } from 'h3'
import { verifyJwt, type JwtPayload } from './jwt'

export async function requireAuth(event: H3Event): Promise<JwtPayload> {
  const authHeader = getHeader(event, 'Authorization') || getHeader(event, 'authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  let payload: JwtPayload
  try {
    payload = await verifyJwt(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Token 无效或已过期' })
  }

  // 校验 Redis 会话是否存在
  const redis = useRedis()
  const sessionExists = await redis.exists(RedisKey.session(payload.userId))
  if (!sessionExists) {
    throw createError({ statusCode: 401, message: '会话已过期，请重新登录' })
  }

  // 校验用户是否存在且未被封号
  const db = useDb()
  const [[user]]: any = await db.query(
    'SELECT id, status FROM t_user WHERE id=? AND deleted=0 LIMIT 1',
    [payload.userId]
  )
  if (!user) {
    throw createError({ statusCode: 403, message: '账号不存在' })
  }
  if (user.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被封禁，无法执行此操作' })
  }

  event.context.user = payload
  return payload
}

