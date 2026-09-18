import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createError, defineEventHandler, getHeader, readBody, readMultipartFormData, readRawBody, send, setHeader, setResponseStatus } from 'h3'
import { requireAuth } from '../../utils/auth.ts'
import { aiRequest } from '../../utils/aiBackend.ts'
import { aiEndpoints } from './endpoints.ts'
import { validateAiParams } from './params.ts'
import { assertAiDeviceAccess, assertAiPetAccess, parseResourceJson } from './access.ts'

export const aiProxyHandler = defineEventHandler(async event => {
  const path = event.path.split('?')[0].slice('/sdkapi/ai-proxy'.length)
  const endpoint = aiEndpoints.find(item => item.path === path)
  if (!endpoint) throw createError({ statusCode: 404, message: 'AI 接口不存在' })
  if (event.method !== 'POST') {
    setHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, message: '仅支持 POST 请求' })
  }
  const user = await requireAuth(event)
  const token = getHeader(event, 'authorization')!.replace('Bearer ', '').trim()
  const raw = await readRawBody(event, false)
  if (raw && raw.length > 128 * 1024) throw createError({ statusCode: 413, message: '请求体过大，请先上传素材再提交 URL' })
  const contentType = (getHeader(event, 'content-type') || '').split(';')[0].trim().toLowerCase()
  let input: unknown
  if (endpoint.multipart && contentType === 'multipart/form-data') {
    const fields = await readMultipartFormData(event)
    const values: Record<string, string> = Object.create(null)
    for (const field of fields ?? []) {
      if (!field.name || field.filename || Object.hasOwn(values, field.name)) {
        throw createError({ statusCode: 400, message: '仅支持无重复的文本字段，请通过 OSS 上传文件' })
      }
      values[field.name] = field.data.toString('utf8')
    }
    input = values
  } else if (contentType === 'application/json') {
    input = await readBody(event)
  } else {
    throw createError({ statusCode: 415, message: endpoint.multipart ? '请使用 multipart 或 JSON 请求体' : '请使用 JSON 请求体' })
  }
  const params = validateAiParams(endpoint, input, user.phone)
  const config = useRuntimeConfig()
  const duration = (value: unknown, fallback: number) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback
  const timeout = endpoint.recordingStop ? duration(config.aiProxyRecordingTimeoutMs, 300000)
    : endpoint.stream ? duration(config.aiProxyStreamTimeoutMs, 300000) : duration(config.aiProxyTimeoutMs, 120000)
  const controller = new AbortController()
  let timedOut = false
  const abortTimeout = () => { timedOut = true; controller.abort() }
  const timer = setTimeout(abortTimeout, timeout)
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const resetIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(abortTimeout, duration(config.aiProxyStreamIdleTimeoutMs, 60000))
  }
  const onClose = () => { if (!event.node.res.writableEnded) controller.abort() }
  event.node.res.once('close', onClose)
  try {
    if (params.pet_id) await assertAiPetAccess(token, String(params.pet_id), user.phone)
    if (endpoint.access === 'device') await assertAiDeviceAccess(token, String(params.device_no))
    // 兼容迁移前创建的会话：先读取其所属宠物，再校验当前用户权限。
    // 只读历史查询也校验权限，不建立易过期的本地 session 镜像。
    if (endpoint.access === 'session') {
      const history = await aiRequest('/session/messages', { session_id: params.session_id }, { signal: controller.signal })
      const text = await history.text()
      let data: any
      try { data = parseResourceJson(text) } catch { throw createError({ statusCode: 502, message: 'AI 会话响应格式异常' }) }
      if (!history.ok || !data || Number(data.code) !== 0 || !data.info?.pet_id) {
        throw createError({ statusCode: 403, message: '无法确认问诊会话权限或会话已失效' })
      }
      await assertAiPetAccess(token, String(data.info.pet_id), user.phone)
      if (path === '/session/messages') {
        setHeader(event, 'Cache-Control', 'no-store')
        return send(event, text, 'application/json; charset=utf-8')
      }
    }
    if (endpoint.stream) resetIdle()
    const upstream = await aiRequest(path, params, { signal: controller.signal, multipart: endpoint.multipart, stream: endpoint.stream })
    setHeader(event, 'Cache-Control', 'no-store, no-transform')
    if (endpoint.stream && upstream.ok && upstream.headers.get('content-type')?.includes('text/event-stream')) {
      if (!upstream.body) throw createError({ statusCode: 502, message: 'AI 流式响应为空' })
      setResponseStatus(event, upstream.status)
      setHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8')
      setHeader(event, 'X-Accel-Buffering', 'no')
      event.node.res.flushHeaders()
      // Node pipeline 保留字节/UTF-8 分片并处理背压；不收集整个答案，不自动重试。
      const heartbeat = new Transform({ transform(chunk, _encoding, callback) { resetIdle(); callback(null, chunk) } })
      await pipeline(Readable.fromWeb(upstream.body as any), heartbeat, event.node.res, { signal: controller.signal })
      return
    }
    // 非流式或上游 HTTP 错误：完整 JSON 原样返回（包括 tasks 的 404）。
    const text = await upstream.text()
    try { JSON.parse(text) } catch { throw createError({ statusCode: 502, message: 'AI 上游响应格式异常' }) }
    if (endpoint.stream && upstream.ok) throw createError({ statusCode: 502, message: 'AI 上游未返回 SSE 流' })
    setResponseStatus(event, upstream.status)
    return send(event, text, 'application/json; charset=utf-8')
  } catch (error: any) {
    if (event.node.res.headersSent || event.node.res.destroyed) {
      // 已开始 SSE 后不能追加 JSON 错误或伪造 done；断开流交由客户端处理。
      event.node.res.destroy()
      return
    }
    if (timedOut) throw createError({ statusCode: 504, message: 'AI 服务响应超时，请稍后重试' })
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, message: 'AI 服务暂时不可用，请稍后重试' })
  } finally {
    clearTimeout(timer)
    clearTimeout(idleTimer)
    event.node.res.off('close', onClose)
    controller.abort()
  }
})
