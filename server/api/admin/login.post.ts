// 管理员账号密码登录（不走手机号/短信）
export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '账号和密码不能为空' })
  }

  const config = useRuntimeConfig()

  if (username !== config.adminUsername || password !== config.adminPassword) {
    throw createError({ statusCode: 401, message: '账号或密码错误' })
  }

  // signJwt 由 server/utils/jwt.ts 自动导入
  const token = await signJwt({ userId: 'admin', phone: 'admin', role: 'admin' } as any)

  const redis = useRedis()
  await redis.setex('session:admin', 86400 * 7, '1')

  return { token, username: config.adminUsername }
})
