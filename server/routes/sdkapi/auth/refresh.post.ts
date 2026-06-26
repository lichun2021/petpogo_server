
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
  const { refreshToken } = await readBody(event)

  if (!refreshToken) {
    throw createError({ statusCode: 400, message: 'refreshToken 不能为空' })
  }

  const redis = useRedis()

  // ── 同步调用对方后台换新 Token ────────────────────────────────
  // 对方返回完整的登录信息（含新 ipet_token + 新 refresh_token + 新 AWS 凭证）
  const peerInfo = await peerRefreshToken(refreshToken)
  const tokenTtl = peerInfo.expiration || 43200

  // ── 用手机号从 DB 找回 userId ─────────────────────────────────
  // peerInfo.account 即为手机号
  const phone = peerInfo.account
  const db = useDb()
  const [[user]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone=? AND deleted=0 LIMIT 1',
    [phone]
  )
  if (!user) {
    throw createError({ statusCode: 404, message: '账号不存在' })
  }
  const userId = String(user.id)

  // ── 写入新的 Redis Session ────────────────────────────────────
  const newSessionKey = tokenSessionKey(peerInfo.ipet_token)
  await redis.setex(newSessionKey, tokenTtl, JSON.stringify({ userId, phone }))

  return {
    // 返回新 token，前端替换本地存储
    token: peerInfo.ipet_token,
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
