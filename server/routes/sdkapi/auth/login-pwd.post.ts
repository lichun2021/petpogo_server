import crypto from 'node:crypto'

// 密码登录
export default defineEventHandler(async (event) => {
  const { phone, password } = await readBody(event)

  if (!phone || !password) {
    throw createError({ statusCode: 400, message: '手机号和密码不能为空' })
  }

  const db = useDb()

  // 查询用户
  const [rows]: any = await db.query(
    'SELECT id, phone, nickname, avatar, password, status, vip_status, vip_expire_at FROM t_user WHERE phone=? AND deleted=0 LIMIT 1',
    [phone]
  )
  const user = rows[0]

  if (!user) {
    throw createError({ statusCode: 404, message: '账号不存在，请先注册' })
  }

  if (user.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

  // 校验密码
  const passwordHash = crypto.createHash('md5').update(password).digest('hex')
  if (user.password !== passwordHash) {
    throw createError({ statusCode: 400, message: '密码错误' })
  }

  const redis = useRedis()

  // 签发 JWT
  const token = await signJwt({ userId: String(user.id), phone: user.phone })

  // 写 Redis 会话（30天）
  await redis.setex(RedisKey.session(String(user.id)), 86400 * 30, '1')

  // 生成 / 读取腾讯 IM UserSig（缓存 6 天）
  const sigKey = RedisKey.imUserSig(String(user.id))
  let userSig = await redis.get(sigKey)
  if (!userSig) {
    userSig = genUserSig(String(user.id))
    await redis.setex(sigKey, 86400 * 6, userSig)
  }

  // 判断 VIP 是否有效（未过期）
  const isVip = user.vip_status === 1 &&
    (user.vip_expire_at === null || new Date(user.vip_expire_at) > new Date())

  return {
    token,
    user: {
      id: String(user.id),
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      isVip,
      vipExpireAt: user.vip_expire_at ? new Date(user.vip_expire_at).toISOString() : null,
    },
    im: {
      sdkAppId: 1600139420,
      userId: String(user.id),
      userSig,
    },
  }
})
