import crypto from 'node:crypto'
import { setHeader } from 'h3'

// 请求日志不预读正文、不序列化响应：避免凭证泄漏、重复缓冲和 SSE 日志缺失。
const shouldLog = (path: string) => ['/api/', '/sdkapi/', '/openapi/'].some(prefix => path.startsWith(prefix))

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('request', event => {
    if (!shouldLog(event.path)) return
    const start = Date.now()
    const requestId = crypto.randomUUID().slice(0, 12)
    event.context.startTime = start
    event.context.reqId = requestId
    setHeader(event, 'X-Request-Id', requestId)
    // 不记录 query；JSON 序列化避免换行注入，限制异常长路径的日志体积。
    const request = { requestId, method: event.method, path: event.path.split('?')[0].slice(0, 240) }
    console.info(JSON.stringify({ time: new Date().toISOString(), event: 'request.start', ...request }))
    let logged = false
    const finish = (closed: boolean) => {
      if (logged) return
      logged = true
      const status = event.node.res.statusCode
      const businessCode = event.context.proxyBusinessCode
      console.info(JSON.stringify({
        time: new Date().toISOString(), event: 'request.end', ...request,
        status, durationMs: Date.now() - start,
        outcome: event.context.proxyOutcome || (closed ? 'client_closed' : status >= 400 ? 'http_error' : event.context.proxyBusinessSuccess === false || (businessCode !== undefined && Number(businessCode) !== 0) ? 'business_error' : event.context.proxySseDone === false ? 'incomplete_stream' : 'complete'),
        firstByteMs: event.context.proxyFirstByteMs,
        streamBytes: event.context.proxyBytes,
        sseDone: event.context.proxySseDone,
        errorType: event.context.requestErrorType,
        errorCode: event.context.requestErrorCode,
        permissionMs: event.context.proxyPermissionMs,
        upstreamHost: event.context.proxyUpstreamHost,
        upstreamPath: event.context.proxyUpstreamPath,
        upstreamStage: status >= 400 ? event.context.proxyUpstreamStage : undefined,
        upstreamStatus: event.context.proxyUpstreamStatus,
        upstreamMs: event.context.proxyUpstreamMs,
        upstreamHeaderMs: event.context.proxyUpstreamHeaderMs,
        businessCode,
      }))
    }
    event.node.res.once('finish', () => finish(false))
    event.node.res.once('close', () => finish(!event.node.res.writableFinished))
  })

  // Nitro 第二个参数是 { event, ... }，不是 event 本身。
  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event || !shouldLog(event.path)) return
    event.context.requestErrorType = /^[A-Za-z0-9_]{1,40}$/.test(error.name) ? error.name : 'Error'
    const code = String((error as any).code || (error as any).cause?.code || '')
    if (/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) event.context.requestErrorCode = code
    // 不记录异常原文/堆栈首行（可能带 SQL、密码或第三方响应）。
    if (Number((error as any).statusCode || 500) >= 500) {
      error.message = '服务器内部错误，请稍后重试'
      ;(error as any).statusMessage = 'Internal Server Error'
    }
  })
})
