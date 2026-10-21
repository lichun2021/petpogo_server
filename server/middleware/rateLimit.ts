import crypto from 'node:crypto'
import { readBody, setHeader } from 'h3'
import { readProxyBody } from '../integrations/shared/bounds'

const WINDOW = 60
const SKIP_PATHS = new Set(['/api/mps/callback', '/api/admin/login', '/api/admin/captcha'])
const REPORT_PATHS = new Set(['/openapi/pet/action/report', '/openapi/device-event/callback'])
const strictPath = (path: string) => path.startsWith('/sdkapi/ai-proxy/') || path === '/sdkapi/upload/sign' || path === '/sdkapi/auth/sms'
const limitValue = (value: unknown, fallback: number) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback

export default defineEventHandler(async event => {
  const path = event.path.split('?')[0]
  if (!['/api/', '/sdkapi/', '/openapi/'].some(prefix => path.startsWith(prefix)) || SKIP_PATHS.has(path)) return
  // 生产反代必须覆盖来访请求自带的XFF；不能将客户端声明的IP当作已认证身份。
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const redis = useRedis()
  async function check(scope: string, subject: string, limit: number) {
    const key = RedisKey.rateLimit(scope, subject)
    const count = Number(await redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      1, key, WINDOW,
    ))
    if (count <= limit) return
    const retryAfterSeconds = Math.max(1, await redis.ttl(key))
    event.context.rateLimit = { scope, limit, count, windowSeconds: WINDOW, retryAfterSeconds }
    event.context.requestErrorCode = 'RATE_LIMIT_EXCEEDED'
    event.context.requestErrorReason = `${scope}限流：${WINDOW}秒最多${limit}次，当前${count}次，${retryAfterSeconds}秒后重试`
    setHeader(event, 'Retry-After', String(retryAfterSeconds))
    throw createError({ statusCode: 429, message: `请求过于频繁，请 ${retryAfterSeconds} 秒后重试`,
      data: { code: 'RATE_LIMIT_EXCEEDED', ...event.context.rateLimit } })
  }
  if (REPORT_PATHS.has(path) && event.context.openapiAuthenticated) {
    const config = useRuntimeConfig()
    await check('openapi:report-ip', ip, limitValue(config.openapiReportIpLimit, 1200))
    await readProxyBody(event)
    const body = await readBody(event)
    const device = path.endsWith('/action/report') ? body?.deviceId : body?.device_mac
    if (typeof device === 'string' && device.trim() && device.length <= 128) {
      const subject = crypto.createHash('sha256').update(device.trim()).digest('hex')
      await check(`openapi:report-device:${path}`, subject, limitValue(config.openapiReportDeviceLimit, 60))
    }
    return
  }
  const surface = path.startsWith('/sdkapi/') ? 'sdkapi' : path.startsWith('/openapi/') ? 'openapi' : 'api'
  await check(`${surface}:${strictPath(path) ? 'strict' : 'default'}`, ip, strictPath(path) ? 20 : 60)
})
