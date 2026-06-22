// server/middleware/openapi-auth.ts
// 拦截 /openapi/ 路径，校验第三方 API 鉴权
//
// 鉴权方式（Header）：
//   x-api-key:    API Key（ce96786dcc394fddeb521d0e）
//   x-timestamp:  毫秒时间戳
//   x-signature:  md5(apiKey + timestamp + apiSecret)

import crypto from 'node:crypto'

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]
  if (!path.startsWith('/openapi/')) return

  const apiKey   = getHeader(event, 'x-api-key')   || ''
  const timestamp = getHeader(event, 'x-timestamp') || ''
  const signature = getHeader(event, 'x-signature') || ''

  console.log(`[OpenAPI] ${event.method} ${path} | key=${apiKey || '(empty)'} ts=${timestamp || '(empty)'} sig=${signature ? signature.substring(0, 8) + '...' : '(empty)'}`)

  if (!apiKey || !timestamp || !signature) {
    throw createError({
      statusCode: 401,
      message: '缺少鉴权头（x-api-key / x-timestamp / x-signature）',
    })
  }

  const config = useRuntimeConfig()

  // 校验 API Key
  if (apiKey !== config.openapiKey) {
    throw createError({ statusCode: 403, message: 'API Key 无效' })
  }

  // 校验时间戳（5 分钟内有效，防重放）
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    throw createError({ statusCode: 403, message: '时间戳过期或格式无效' })
  }

  // 校验签名：md5(apiKey + timestamp + apiSecret)
  const expected = crypto
    .createHash('md5')
    .update(`${apiKey}${ts}${config.openapiSecret}`)
    .digest('hex')

  if (signature !== expected) {
    throw createError({ statusCode: 403, message: '签名验证失败' })
  }
})
