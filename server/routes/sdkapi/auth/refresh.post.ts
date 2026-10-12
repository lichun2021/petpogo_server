
/**
 * POST /sdkapi/auth/refresh
 * Token 刷新接口
 *
 * 请求方式：前端把登录时返回的 peer.refreshToken 放在请求体里
 * 注意：此处不能用 ipet_token（已过期），要用 refresh_token（30天有效）
 *
 * Body: { refreshToken: string }
 */
export default defineEventHandler(async (event) => {
  event.context.authStage = 'refresh_input'
  const { refreshToken } = (await readBody(event)) || {}

  if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
    throw createError({ statusCode: 400, message: 'refreshToken 不能为空' })
  }

  event.context.authStage = 'refresh_proof'
  const redis = useRedis()

  const proofKey = RedisKey.refreshProof(tokenSessionKey(String(refreshToken)))
  const rawProof = await redis.get(proofKey)
  if (!rawProof) throw createError({ statusCode: 401, message: '请重新登录' })
  const proof = JSON.parse(rawProof)
  event.context.authStage = 'refresh_account_check'
  const [[current]]: any = await useDb().query('SELECT credential_version,status FROM t_user WHERE id=? AND deleted=0', [proof.userId])
  event.context.authDiagnostics = { accountFound: !!current, accountDisabled: current?.status === 2, credentialMatches: !!current && Number(current.credential_version || 0) === Number(proof.credentialVersion || 0) }
  if (!current || current.status === 2 || Number(current.credential_version || 0) !== Number(proof.credentialVersion || 0)) throw createError({ statusCode: 401, message: '登录凭证已失效' })
  // ── 同步调用对方后台换新 Token ────────────────────────────────
  // 对方返回完整的登录信息（含新 ipet_token + 新 refresh_token + 新 AWS 凭证）
  event.context.authStage = 'peer_refresh'
  const peerInfo = await peerRefreshToken(refreshToken, event.context.reqId)
  event.context.authStage = 'refreshed_response_check'
  const tokenTtl = peerInfo?.expiration == null ? 43200 : Number(peerInfo.expiration)
  if (typeof peerInfo?.ipet_token !== 'string' || !peerInfo.ipet_token.trim() ||
      !Number.isSafeInteger(tokenTtl) || tokenTtl <= 0 ||
      (peerInfo.refresh_token != null && typeof peerInfo.refresh_token !== 'string')) {
    throw createError({ statusCode: 502, message: '刷新返回凭证格式异常' })
  }
  const nextRefreshToken = peerInfo.refresh_token || refreshToken
  event.context.authStage = 'local_account_lookup'

  // 根据刷新凭证定位本地用户；上游 account 是手机号@qq.com，不能查询 phone 列。
  const account = peerInfo.account
  event.context.authDiagnostics = { upstreamRefreshSucceeded: true, accountFieldPresent: typeof account === 'string' && account.length > 0, accountFormat: typeof account !== 'string' || !account ? 'missing' : account.includes('@') ? 'email' : /^\+?\d+$/.test(account) ? 'phone' : 'other' }
  const db = useDb()
  const [[user]]: any = await db.query(
    'SELECT id,phone,credential_version,status FROM t_user WHERE id=? AND deleted=0 LIMIT 1',
    [proof.userId]
  )
  event.context.authDiagnostics.localAccountFound = !!user
  if (!user) {
    throw createError({ statusCode: 404, message: '账号不存在' })
  }
  const userId = String(user.id)
  const phone = user.phone
  event.context.authStage = 'refreshed_identity_check'
  Object.assign(event.context.authDiagnostics, { identityMatches: userId === proof.userId, accountDisabled: user.status === 2, credentialMatches: Number(user.credential_version || 0) === Number(proof.credentialVersion || 0) })
  if (userId !== proof.userId || user.status === 2 || Number(user.credential_version || 0) !== Number(proof.credentialVersion || 0)) throw createError({ statusCode: 401, message: '登录凭证已失效' })

  event.context.authStage = 'refreshed_account_check'
  event.context.authDiagnostics.peerAccountMatches = typeof phone === 'string' && account === phoneToAccount(phone)
  if (!event.context.authDiagnostics.peerAccountMatches) {
    throw createError({ statusCode: 502, message: '刷新返回账号与本地账号不匹配' })
  }

  event.context.authStage = 'save_session'
  // ── 写入新的 Redis Session ────────────────────────────────────
  const newSessionKey = tokenSessionKey(peerInfo.ipet_token)
  await redis.setex(newSessionKey, tokenTtl, JSON.stringify({ userId, phone, credentialVersion: Number(user.credential_version || 0) }))

  // 未轮换时保留原刷新凭证及其原有效期，不无条件延长其寿命。
  if (nextRefreshToken !== refreshToken) {
    await redis.setex(RedisKey.refreshProof(tokenSessionKey(nextRefreshToken)), 30 * 86400, JSON.stringify(proof))
    await redis.del(proofKey)
  }
  return {
    // 返回新 token，前端替换本地存储
    token: peerInfo.ipet_token,
    peer: {
      gatewayUrl: getPeerPublicUrl(),
      granwinToken: peerInfo.ipet_token,
      refreshToken: nextRefreshToken,
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
