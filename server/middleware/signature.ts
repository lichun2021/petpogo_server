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
    throw createError({ statusCode: 401, message: '缺少请求签名 (Missing signature headers)' })
  }

  const ts = Number(timestamp)
  if (!/^\d{13}$/.test(timestamp) || !Number.isSafeInteger(ts)) {
    throw createError({ statusCode: 400, message: '无效的时间戳格式' })
  }

  // 验证时间戳，防止重放攻击 (误差允许 5 分钟)
  const now = Date.now()
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    throw createError({ statusCode: 403, message: '请求时间戳过期或误差过大 (Request expired)' })
  }

  const config = useRuntimeConfig()
  const secret = config.appApiSecret

  // 计算签名： md5(timestamp + secret)
  const expectedSignature = crypto.createHash('md5').update(`${ts}${secret}`).digest('hex')

  if (!/^[a-f0-9]{32}$/.test(signature) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw createError({ statusCode: 403, message: '请求签名验证失败 (Invalid signature)' })
  }

  // ── nonce 防重放 ──────────────────────────────────────────
  // nonce 与有效期使用 SET EX NX 原子写入；TTL 覆盖客户端时钟超前的窗口。
  //
  // 过渡期：runtimeConfig.signatureNonceRequired 控制行为
  //   true  （默认，App 端已升级后）—— 缺失或重复 nonce 直接 400/403 拒绝
  //   false （App 端未升级时）       —— 过渡期不拦截
  const nonce = getHeader(event, 'x-nonce')
  if (!nonce || nonce.length < 8 || nonce.length > 128) {
    if (config.signatureNonceRequired) {
      throw createError({ statusCode: 400, message: '缺少 nonce 防重放标识' })
    }
    return
  }

  const redis = useRedis()
  const nonceKey = RedisKey.nonce(nonce)
  const ttl = Math.max(1, Math.ceil((ts + 5 * 60 * 1000 - now) / 1000))
  const set = await redis.set(nonceKey, '1', 'EX', ttl, 'NX')
  if (set !== 'OK') {
    if (config.signatureNonceRequired) {
      throw createError({ statusCode: 403, message: '请求已处理，请勿重放' })
    }
    return
  }
})
