

// 密码登录
export default defineEventHandler(async (event) => {
  const { phone, password, nationNum = '86' } = await readBody(event)

  if (!phone || !password) {
    throw createError({ statusCode: 400, message: '手机号和密码不能为空' })
  }

  // 规范化手机号
  const dialCode = String(nationNum).replace(/^\+/, '')
  const normalizedPhone = dialCode === '86' ? phone : `+${dialCode}${phone}`

  const rateKey = RedisKey.userLoginFail(normalizedPhone)
  await assertNotLocked(rateKey)

  const db = useDb()

  const [rows]: any = await db.query(
    'SELECT id, phone, nickname, avatar, password, credential_version, status, plan_type, plan_expire_at FROM t_user WHERE phone=? AND deleted=0 LIMIT 1',
    [normalizedPhone]
  )
  const user = rows[0]

  if (!user) {
    throw createError({ statusCode: 404, message: '该手机号尚未注册，请切换为「验证码登录」完成注册' })
  }
  if (user.status === 2) {
    throw createError({ statusCode: 403, message: '账号已被禁用' })
  }

  if (needsPasswordSetup(user.password)) throw createError({ statusCode: 403, message: '请使用短信登录并设置个人密码', data: { code: 'PASSWORD_SETUP_REQUIRED' } })
  if (!await verifyUserPassword(password, user.password)) {
    await recordLoginFailure(rateKey)
    throw createError({ statusCode: 400, message: '密码错误' })
  }
  if (!user.password.startsWith('scrypt:')) {
    const upgraded = await hashUserPassword(password)
    await db.query('UPDATE t_user SET password=? WHERE id=? AND password=?', [upgraded, String(user.id), user.password])
  }

  await clearLoginFailures(rateKey)

  const userId = String(user.id)
  const redis = useRedis()

  // ── 同步对方后台（确保 iPet 账号存在，再登录）───────────────────
  await peerEnsureRegistered(normalizedPhone, event.context.reqId)
  const peerInfo = await peerLogin(normalizedPhone, event.context.reqId)
  const tokenTtl = peerInfo.expiration || 43200

  // ── 写入 Redis Session ────────────────────────────────────────
  const sessionKey = tokenSessionKey(peerInfo.ipet_token)
  await redis.setex(sessionKey, tokenTtl, JSON.stringify({ userId, phone: normalizedPhone, credentialVersion: Number(user.credential_version || 0) }))

  if (peerInfo.refresh_token) await redis.setex(RedisKey.refreshProof(tokenSessionKey(peerInfo.refresh_token)), 30 * 86400, JSON.stringify({ userId, credentialVersion: Number(user.credential_version || 0) }))
  // ── 腾讯 IM ──────────────────────────────────────────────────
  const sigKey = RedisKey.imUserSig(userId)
  let userSig = await redis.get(sigKey)
  if (!userSig) {
    userSig = genUserSig(userId)
    await redis.setex(sigKey, 86400 * 6, userSig)
  }

  const points = await getPointsBalance(userId)

  return {
    token: peerInfo.ipet_token,
    user: {
      id: userId,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      planType: user.plan_type,
      planExpireAt: user.plan_expire_at ? new Date(user.plan_expire_at).toISOString() : null,
      points,
    },
    im: {
      sdkAppId: 1600139420,
      userId,
      userSig,
    },
    peer: {
      gatewayUrl: getPeerPublicUrl(),
      granwinToken: peerInfo.ipet_token,
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
