import crypto from 'node:crypto'
import { setHeader } from 'h3'
import { formatRequestLog, requestErrorSummary, httpErrorReason } from '../utils/requestLog'

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
    const peer = request.path.startsWith('/sdkapi/peer/')
    let requestLogged = false
    const logRequest = (body?: unknown) => {
      if (requestLogged) return
      requestLogged = true
      console.info(formatRequestLog({ event: 'request.start', message: '请求', ...request, ...(peer ? { body: body ?? null } : {}) }))
    }
    if (peer) event.context.logPeerRequest = logRequest
    else logRequest()
    let logged = false
    const finish = (closed: boolean) => {
      if (logged) return
      logged = true
      logRequest()
      const status = event.node.res.statusCode
      const businessCode = event.context.proxyBusinessCode
      const businessFailed = event.context.proxyBusinessSuccess === false || (businessCode !== undefined && Number(businessCode) !== 0)
      console.info(formatRequestLog({
        event: 'request.end', message: '返回', ...request,
        ...(peer ? { body: event.context.peerResponseBody ?? { message: event.context.requestErrorReason || '未取得业务响应正文' } } : {}),
        level: status >= 500 ? 'error' : status >= 400 || businessFailed ? 'warn' : 'info',
        status, durationMs: Date.now() - start,
        outcome: event.context.proxyOutcome || (closed ? 'client_closed' : status >= 400 ? 'http_error' : event.context.proxyBusinessSuccess === false || (businessCode !== undefined && Number(businessCode) !== 0) ? 'business_error' : event.context.proxySseDone === false ? 'incomplete_stream' : 'complete'),
        firstByteMs: event.context.proxyFirstByteMs,
        streamBytes: event.context.proxyBytes,
        sseDone: event.context.proxySseDone,
        errorType: event.context.requestErrorType,
        errorCode: event.context.requestErrorCode,
        errorReason: status >= 400 ? event.context.requestErrorReason || httpErrorReason(status) : businessFailed ? '上游业务处理失败，请结合businessCode和响应正文排查' : undefined,
        authStage: status >= 400 ? event.context.authStage : undefined,
        authDiagnostics: status >= 400 ? event.context.authDiagnostics : undefined,
        rateLimit: status === 429 ? event.context.rateLimit : undefined,
        localSync: event.context.peerLocalSync,
        localSyncMs: event.context.peerLocalSyncMs,
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
    const summary = requestErrorSummary(error, event.context.authStage)
    if (summary) {
      event.context.requestErrorCode ||= summary.code
      event.context.requestErrorReason = summary.reason
    }
    // 不记录异常原文/堆栈首行（可能带 SQL、密码或第三方响应）。
    if (Number((error as any).statusCode || 500) >= 500) {
      error.message = '服务器内部错误，请稍后重试'
      ;(error as any).statusMessage = 'Internal Server Error'
    }
  })
})
