import crypto from 'node:crypto'

// 需要跳过签名的路径，例如后台管理接口、上传接口等
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] 

  // 只拦截 /sdkapi 的请求 (App 专用)
  if (!path.startsWith('/sdkapi/')) {
    return
  }

  // 获取请求头中的 timestamp 和 signature
  // App端请求头要求：
  // x-timestamp: 1680000000000 (毫秒)
  // x-signature: md5(timestamp + appApiSecret)
  
  const timestamp = getHeader(event, 'x-timestamp')
  const signature = getHeader(event, 'x-signature')

  // 如果是在开发环境且没有传签名，也许可以放行以方便调试（可选），但根据需求严格校验
  if (!timestamp || !signature) {
    console.warn(`[Signature] 拦截: 缺少请求签名 - path: ${path}, ts: ${timestamp}, sig: ${signature}`)
    throw createError({ statusCode: 401, message: '缺少请求签名 (Missing signature headers)' })
  }

  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) {
    console.warn(`[Signature] 拦截: 时间戳格式无效 - path: ${path}, ts: ${timestamp}`)
    throw createError({ statusCode: 400, message: '无效的时间戳格式' })
  }

  // 验证时间戳，防止重放攻击 (误差允许 5 分钟)
  const now = Date.now()
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    console.warn(`[Signature] 拦截: 时间戳过期 - path: ${path}, serverNow: ${now}, clientTs: ${ts}, diff: ${Math.abs(now - ts)}ms`)
    throw createError({ statusCode: 403, message: '请求时间戳过期或误差过大 (Request expired)' })
  }

  const config = useRuntimeConfig()
  const secret = config.appApiSecret

  // 计算签名： md5(timestamp + secret)
  const expectedSignature = crypto.createHash('md5').update(`${ts}${secret}`).digest('hex')

  if (signature !== expectedSignature) {
    console.warn(`[Signature] 拦截: 签名不匹配 - path: ${path}, clientSig: ${signature}, expected: ${expectedSignature}, secret: ${secret}`)
    throw createError({ statusCode: 403, message: '请求签名验证失败 (Invalid signature)' })
  }

  // ── nonce 防重放 ──────────────────────────────────────────
  // App 端每个请求需带 x-nonce（≥8 位随机串），服务端用 Redis SETNX 去重，
  // TTL 与时间戳窗口对齐（5 分钟），窗口内同一 nonce 只能被消费一次。
  //
  // 过渡期：runtimeConfig.signatureNonceRequired 控制行为
  //   true  （默认，App 端已升级后）—— 缺失或重复 nonce 直接 400/403 拒绝
  //   false （App 端未升级时）       —— 只 console.warn 告警，不拦截，保证零中断
  const nonce = getHeader(event, 'x-nonce')
  if (!nonce || nonce.length < 8) {
    if (config.signatureNonceRequired) {
      console.warn(`[Signature] 拦截: 缺少 nonce - path: ${path}, nonce: ${nonce}`)
      throw createError({ statusCode: 400, message: '缺少 nonce 防重放标识' })
    }
    console.warn(`[Signature] 告警(过渡期未拦截): 缺少 nonce - path: ${path}`)
    return
  }

  const redis = useRedis()
  const nonceKey = RedisKey.nonce(nonce)
  const set = await redis.setnx(nonceKey, '1')
  if (set !== 1) {
    if (config.signatureNonceRequired) {
      console.warn(`[Signature] 拦截: nonce 重复(疑似重放) - path: ${path}, nonce: ${nonce}`)
      throw createError({ statusCode: 403, message: '请求已处理，请勿重放' })
    }
    console.warn(`[Signature] 告警(过渡期未拦截): nonce 重复 - path: ${path}, nonce: ${nonce}`)
    return
  }
  // TTL 与时间戳窗口对齐（5 分钟）
  await redis.expire(nonceKey, 5 * 60)
})
