// CC 限流中间件：基于 Redis 固定窗口的 IP 维度频率限制
//
// 覆盖范围：/sdkapi/**、/api/**、/openapi/** 三个 API 面
// 分档阈值：
//   默认档  60s / 60 次   —— 通用接口
//   严格档  60s / 20 次   —— 重接口（AI 分析、上传预签名、短信发送）
//
// 豁免：
//   /api/mps/callback          —— MNS 回调走 token 鉴权，且来源固定
//   /api/admin/login|captcha   —— 已有滑块验证 + 失败次数锁定，避免双重限流误伤
//
// 注意：中间件按文件名字母序加载，rateLimit 排在 signature 之前，
//       所以 /sdkapi/** 的非法请求（无签名）也会被限流计数，更能防 CC。
//
// IP 来源：h3 getRequestIP(event, { xForwardedFor: true })，生产经 nginx 代理读 XFF；
//         取不到时（如本地）用 'unknown' 兜底，不影响正常请求。

// 默认窗口与阈值
const DEFAULT_WINDOW = 60   // 秒
const DEFAULT_LIMIT  = 60    // 次
const STRICT_LIMIT   = 20    // 次（敏感端点）

// 严格限流端点匹配
function isStrictPath(path: string): boolean {
  return path.startsWith('/sdkapi/ai-proxy/')
      || path === '/sdkapi/upload/sign'
      || path === '/sdkapi/auth/sms'
}

// 豁免路径（精确匹配）
const SKIP_PATHS = new Set<string>(['/api/mps/callback'])

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]

  // 只覆盖三个 API 面
  if (!path.startsWith('/sdkapi/') && !path.startsWith('/api/') && !path.startsWith('/openapi/')) return

  // 豁免
  if (SKIP_PATHS.has(path)) return
  if (path === '/api/admin/login' || path === '/api/admin/captcha') return

  // 客户端 IP
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  // 分档
  const limit  = isStrictPath(path) ? STRICT_LIMIT : DEFAULT_LIMIT
  const surface = path.startsWith('/sdkapi/') ? 'sdkapi'
                : path.startsWith('/api/')    ? 'api'
                : 'openapi'

  const redis = useRedis()
  const key   = RedisKey.rateLimit(`${surface}:${isStrictPath(path) ? 'strict' : 'default'}`, ip)
  const count = Number(await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
    1, key, DEFAULT_WINDOW,
  ))

  if (count > limit) {
    const ttl     = await redis.ttl(key)
    const minutes = Math.max(1, Math.ceil(ttl / 60))
    throw createError({
      statusCode: 429,
      message: `请求过于频繁，请 ${minutes} 分钟后重试`,
    })
  }
})
