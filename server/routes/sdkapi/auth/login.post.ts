// 短信验证码登录/注册
export default defineEventHandler(async (event) => {
  const { phone, code } = await readBody(event)

  if (!phone || !code) {
    throw createError({ statusCode: 400, message: '手机号和验证码不能为空' })
  }

  const redis = useRedis()
  const smsKey = RedisKey.smsCode(phone)
  const raw = await redis.get(smsKey)

  if (!raw) {
    throw createError({ statusCode: 400, message: '验证码已过期，请重新获取' })
  }

  const { code: savedCode, attempts } = JSON.parse(raw)

  if (attempts >= 5) {
    await redis.del(smsKey)
    throw createError({ statusCode: 400, message: '验证码已失效，请重新获取' })
  }

  if (savedCode !== code) {
    await redis.setex(smsKey, await redis.ttl(smsKey), JSON.stringify({ code: savedCode, attempts: attempts + 1 }))
    throw createError({ statusCode: 400, message: `验证码错误，还剩 ${4 - attempts} 次机会` })
  }

  await redis.del(smsKey)

  const db = useDb()

  // 查询用户
  const [rows]: any = await db.query(
    'SELECT id, phone, nickname, avatar, status FROM t_user WHERE phone=? AND deleted=0 LIMIT 1',
    [phone]
  )
  let user = rows[0]

  // 不存在则自动注册
  if (!user) {
    const id = generateId()
    const nickname = `宠友${phone.slice(-4)}`
    // 默认密码 123456 (md5)
    const defaultPassword = 'e10adc3949ba59abbe56e057f20f883e'
    await db.query(
      'INSERT INTO t_user(id, phone, password, nickname, status, created_at) VALUES(?,?,?,?,1,NOW())',
      [id, phone, defaultPassword, nickname]
    )
    user = { id, phone, nickname, avatar: null }

    // 异步同步到腾讯 IM（不阻塞登录）
    imImportAccount(String(id), nickname).catch(e =>
      console.error('IM账号同步失败:', e.message)
    )
  }

  if (user.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

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

  return {
    token,
    user: {
      id:       String(user.id),
      phone:    user.phone,
      nickname: user.nickname,
      avatar:   user.avatar,
    },
    im: {
      sdkAppId: 1600139420,
      userId:   String(user.id),
      userSig,
    },
  }
})
