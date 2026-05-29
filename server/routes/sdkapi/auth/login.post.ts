
// 短信验证码登录/注册
export default defineEventHandler(async (event) => {
  const { phone, code, nationNum = '86' } = await readBody(event)

  if (!phone || !code) {
    throw createError({ statusCode: 400, message: '手机号和验证码不能为空' })
  }

  // 规范化手机号（与 sms.post.ts 保持一致）
  const dialCode = String(nationNum).replace(/^\+/, '')
  const normalizedPhone = dialCode === '86' ? phone : `+${dialCode}${phone}`

  const redis = useRedis()
  const smsKey = RedisKey.smsCode(normalizedPhone)
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

  // 查询用户（用规范化手机号）
  const [rows]: any = await db.query(
    'SELECT id, phone, nickname, avatar, status, vip_status, vip_expire_at FROM t_user WHERE phone=? AND deleted=0 LIMIT 1',
    [normalizedPhone]
  )
  let user = rows[0]
  let isNewUser = false

  // 不存在则自动注册
  if (!user) {
    // 检查系统是否开放注册
    const registerOpen = await getSettingBool('register_open', true)
    if (!registerOpen) {
      throw createError({ statusCode: 403, message: '当前暂不开放新用户注册，请联系客服' })
    }

    isNewUser = true
    const id = generateId()
    const nickname = `宠友${normalizedPhone.slice(-4)}`
    const defaultPassword = 'e10adc3949ba59abbe56e057f20f883e' // md5(123456)

    // 新用户 AI 每日上限从系统设置读取
    const aiLimit = await getSettingNumber('ai_default_daily_limit', 10)
    await db.query(
      'INSERT INTO t_user(id, phone, password, nickname, status, ai_daily_limit, created_at) VALUES(?,?,?,?,1,?,NOW())',
      [id, normalizedPhone, defaultPassword, nickname, aiLimit]
    )
    user = { id, phone: normalizedPhone, nickname, avatar: null, vip_status: 0, vip_expire_at: null }
  }

  if (user.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

  const userId = String(user.id)

  // ── 同步对方后台：确保账号存在，再登录拿 token ─────────────
  await peerEnsureRegistered(normalizedPhone)
  const peerInfo = await peerLogin(normalizedPhone)

  // granwin_token 有效期（对方返回 expiration 秒，默认 43200 = 12小时）
  const tokenTtl = peerInfo.expiration || 43200

  // ── 将 granwin_token → 用户信息的映射写入 Redis ─────────────────
  // 前端用此 token 访问本后台时，通过 Redis 反查 userId
  const sessionKey = tokenSessionKey(peerInfo.granwin_token)
  await redis.setex(sessionKey, tokenTtl, JSON.stringify({ userId, phone }))

  // ── 腾讯 IM UserSig（异步，不阻塞主流程）────────────────────────
  const sigKey = RedisKey.imUserSig(userId)
  let userSig = await redis.get(sigKey)
  if (!userSig) {
    userSig = genUserSig(userId)
    await redis.setex(sigKey, 86400 * 6, userSig)
  }
  if (isNewUser) {
    imImportAccount(userId, user.nickname).catch((e: any) =>
      console.error('[IM] 账号同步失败:', e.message)
    )
  }

  // VIP 判断
  const isVip = user.vip_status === 1 &&
    (user.vip_expire_at === null || new Date(user.vip_expire_at) > new Date())

  return {
    // ─ 本后台相关 ────────────────────────────────────────────────
    // token 与 granwin_token 是同一个，前端访问本后台用 Authorization: Bearer <token>
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
    // ─ 对方后台相关（前端直连宠物/设备接口所需的全部信息）────────────
    peer: {
      // 前端直连对方后台的公网地址
      gatewayUrl: getPeerPublicUrl(),
      // granwin_token：前端请求对方后台时放入 token Header
      granwinToken: peerInfo.granwin_token,
      // refresh_token：granwin_token 过期后用于换新 token
      refreshToken: peerInfo.refresh_token,
      // token 有效期（秒）
      expiresIn: tokenTtl,
      // AWS IoT 连接信息（前端直连设备 MQTT 所需）
      iot: {
        endpoint: peerInfo.endpoint,
        region: peerInfo.region,
      },
      // AWS Cognito Identity Pool（前端 SDK 初始化所需）
      pool: peerInfo.pool,
      // AWS 临时凭证（前端访问 S3/IoT 所需）
      proof: peerInfo.proof,
    },
  }
})
