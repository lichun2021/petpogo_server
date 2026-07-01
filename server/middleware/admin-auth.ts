// 拦截 /api/admin/** 的请求，校验管理员 JWT（login/captcha 接口本身除外）
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]

  if (!path.startsWith('/api/admin/')) return
  if (path === '/api/admin/login') return
  if (path === '/api/admin/captcha') return

  const authHeader = getHeader(event, 'Authorization') || getHeader(event, 'authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  let payload: JwtPayload
  try {
    payload = await verifyJwt(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Token 无效或已过期，请重新登录' })
  }

  // 单会话校验：新登录会顶掉旧 token，这里发现哈希不一致说明该 token 已被顶替
  const redis = useRedis()
  const activeHash = await redis.get(RedisKey.adminSession(payload.adminId))
  if (!activeHash || activeHash !== hashAdminToken(token)) {
    throw createError({ statusCode: 401, message: '账号已在其他地方登录，请重新登录' })
  }

  // DB 二次校验，防止账号被禁用/删除后旧 token 在有效期内仍可使用
  const db = useDb()
  const [[admin]]: any = await db.query(
    'SELECT id, username, role, status FROM t_admin WHERE id=? AND deleted=0 LIMIT 1',
    [payload.adminId]
  )

  if (!admin) {
    throw createError({ statusCode: 403, message: '管理员账号不存在' })
  }
  if (admin.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

  event.context.admin = { adminId: String(admin.id), username: admin.username, role: admin.role }
})
