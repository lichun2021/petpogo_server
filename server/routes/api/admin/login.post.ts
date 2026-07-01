// 管理员账号密码登录（不走手机号/短信）
const CAPTCHA_TOLERANCE = 6 // px，滑块允许的误差

export default defineEventHandler(async (event) => {
  const { username, password, captchaToken, captchaOffset } = await readBody(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '账号和密码不能为空' })
  }
  if (!captchaToken || typeof captchaOffset !== 'number') {
    throw createError({ statusCode: 400, message: '请先完成滑动验证' })
  }

  const rateKey = RedisKey.adminLoginFail(username)
  await assertNotLocked(rateKey)

  const redis = useRedis()
  const captchaKey = RedisKey.adminCaptcha(captchaToken)
  const target = await redis.get(captchaKey)
  await redis.del(captchaKey) // 一次性使用，无论成功失败都失效

  if (target === null) {
    throw createError({ statusCode: 400, message: '验证已过期，请重新滑动验证' })
  }
  if (Math.abs(captchaOffset - Number(target)) > CAPTCHA_TOLERANCE) {
    throw createError({ statusCode: 400, message: '验证失败，请重新滑动验证' })
  }

  const db = useDb()
  const [[admin]]: any = await db.query(
    'SELECT id, username, password, nickname, role, status FROM t_admin WHERE username=? AND deleted=0 LIMIT 1',
    [username]
  )

  if (!admin || !verifyPassword(password, admin.password)) {
    await recordLoginFailure(rateKey)
    throw createError({ statusCode: 401, message: '账号或密码错误' })
  }
  if (admin.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

  await clearLoginFailures(rateKey)

  // signJwt 由 server/utils/jwt.ts 自动导入
  const token = await signJwt({ adminId: String(admin.id), username: admin.username, role: admin.role })

  // 同一账号只保留最近一次登录的 token（新登录顶掉旧会话）
  await redis.setex(RedisKey.adminSession(String(admin.id)), ADMIN_SESSION_TTL, hashAdminToken(token))

  await db.query('UPDATE t_admin SET last_login_at=NOW() WHERE id=?', [admin.id])

  return { token, id: String(admin.id), username: admin.username, nickname: admin.nickname, role: admin.role }
})
