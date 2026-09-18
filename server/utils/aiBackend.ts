// AI 服务器唯一 HTTP 出口。中转和原有分析业务共用地址及签名，响应处理各自独立。
import crypto from 'node:crypto'
import { createError } from 'h3'

export type AiParams = Record<string, string | number | boolean | number[]>

export async function aiRequest(path: string, params: AiParams, options: {
  signal: AbortSignal
  multipart?: boolean
  stream?: boolean
}) {
  const config = useRuntimeConfig()
  const { aiServiceUrl: base, aiApiKey: key, aiApiSecret: secret } = config
  if (!base || !key || !secret) throw createError({ statusCode: 503, message: 'AI 中转服务尚未配置' })
  if (!/^\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) {
    throw createError({ statusCode: 500, message: 'AI 接口路径配置错误' })
  }
  const target = new URL(`${String(base).replace(/\/+$/, '')}${path}`)
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw createError({ statusCode: 503, message: 'AI 上游地址配置错误' })
  }
  const timestamp = String(Date.now())
  const headers: Record<string, string> = {
    'X-API-Key': String(key), 'X-Timestamp': timestamp,
    'X-Signature': crypto.createHash('md5').update(`${key}${timestamp}${secret}`).digest('hex'),
    Accept: options.stream ? 'text/event-stream' : '*/*',
  }
  let body: string | FormData
  if (options.multipart) {
    body = new FormData()
    for (const [key, value] of Object.entries(params)) body.append(key, String(value))
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(params)
  }
  // 原始 Response：SSE 交给路由逐块转发，普通 JSON 不二次序列化。
  const response = await fetch(target, { method: 'POST', headers, body, signal: options.signal, redirect: 'manual' })
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    throw createError({ statusCode: 502, message: 'AI 上游返回了重定向' })
  }
  // 应用签名失败不应被客户端当作自身登录过期。
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel()
    throw createError({ statusCode: 502, message: 'AI 服务鉴权失败' })
  }
  return response
}
