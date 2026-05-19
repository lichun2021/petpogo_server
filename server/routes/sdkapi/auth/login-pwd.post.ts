import crypto from 'node:crypto'

// 密码登录
export default defineEventHandler(async (event) => {
  const { phone, password } = await readBody(event)

  if (!phone || !password) {
    throw createError({ statusCode: 400, message: '手机号和密码不能为空' })
  }

  const db = useDb()

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

  const passwordHash = crypto.createHash('md5').update(password).digest('hex')

  // 若账号从未设置密码（password 为空/null），视同初始密码 md5(123456)
  const DEFAULT_PWD = 'e10adc3949ba59abbe56e057f20f883e'
  const storedPwd   = (user.password && user.password.length > 0) ? user.password : DEFAULT_PWD

  if (storedPwd !== passwordHash) {
    throw createError({ statusCode: 400, message: '密码错误' })
  }

  const userId = String(user.id)
  const redis = useRedis()

  // ── 同步对方后台（确保 iPet 账号存在，再登录）───────────────────
  await peerEnsureRegistered(phone)
  const peerInfo = await peerLogin(phone)
  const tokenTtl = peerInfo.expiration || 43200

  // ── 写入 Redis Session ────────────────────────────────────────
  const sessionKey = tokenSessionKey(peerInfo.granwin_token)
  await redis.setex(sessionKey, tokenTtl, JSON.stringify({ userId, phone }))

  // ── 腾讯 IM ──────────────────────────────────────────────────
  const sigKey = RedisKey.imUserSig(userId)
  let userSig = await redis.get(sigKey)
  if (!userSig) {
    userSig = genUserSig(userId)
    await redis.setex(sigKey, 86400 * 6, userSig)
  }

  const isVip = user.vip_status === 1 &&
    (user.vip_expire_at === null || new Date(user.vip_expire_at) > new Date())

  return {
    token: peerInfo.granwin_token,
    user: {
      id: userId,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      isVip,
      vipExpireAt: user.vip_expire_at ? new Date(user.vip_expire_at).toISOString() : null,
    },
    im: {
      sdkAppId: 1600139420,
      userId,
      userSig,
    },
    peer: {
      gatewayUrl: getPeerPublicUrl(),
      granwinToken: peerInfo.granwin_token,
      refreshToken: peerInfo.refresh_token,
      expiresIn: tokenTtl,
      iot: {
        endpoint: peerInfo.endpoint,
        region: peerInfo.region,
      },
      pool: peerInfo.pool,
      proof: peerInfo.proof,
    },
  }
})
