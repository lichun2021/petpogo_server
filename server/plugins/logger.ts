// ── 全局注入时间戳，所有 console.log/warn/error 自动带时间 ──────────
const _ts = () => new Date().toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
}).replace(/\//g, '-')

const _orig = { log: console.log, warn: console.warn, error: console.error, info: console.info }
console.log   = (...a) => _orig.log  (`[${_ts()}]`, ...a)
console.info  = (...a) => _orig.info (`[${_ts()}]`, ...a)
console.warn  = (...a) => _orig.warn (`[${_ts()}]`, ...a)
console.error = (...a) => _orig.error(`[${_ts()}]`, ...a)

// ─────────────────────────────────────────────────────────────────────

const shouldLog = (path: string) =>
  (typeof path === 'string') &&
  (path.startsWith('/sdkapi/') || path.startsWith('/api/') || path.startsWith('/openapi/'))

// 生成 4 位短请求 ID，用于并发请求时把 [IN] 和 [OUT]/[Error] 配对
function shortReqId(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    if (!shouldLog(event.path)) return

    event.context.startTime = Date.now()
    event.context.reqId = shortReqId()
    const rid = event.context.reqId
    // 中转内容含凭证、问诊或媒体地址，只记录路径及状态；也避免预读 multipart/SSE。
    const isProxy = event.path.startsWith('/sdkapi/peer/') || event.path.startsWith('/sdkapi/ai-proxy/')

    let bodyStr = ''
    if (!isProxy && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) {
      try {
        if (!event.path.includes('/upload')) {
          const body = await readBody(event)
          if (body) bodyStr = ` | Body: ${JSON.stringify(body)}`
        } else {
          bodyStr = ` | Body: [FormData/File]`
        }
      } catch (e) { /* 忽略无法解析的 body */ }
    }

    const queryStr = !isProxy && Object.keys(getQuery(event)).length
      ? ` | Query: ${JSON.stringify(getQuery(event))}`
      : ''

    _orig.log(`\n┌─── [API 请求] ${_ts()} #${rid} ──────────────────────`)
    _orig.log(`│ #${rid} [IN] ${event.method} ${isProxy ? event.path.split('?')[0] : event.path}${queryStr}${bodyStr}`)
  })

  // 正常响应：打印 [OUT]（beforeResponse 在抛错时不触发）
  nitroApp.hooks.hook('beforeResponse', async (event, { body }) => {
    if (!shouldLog(event.path)) return

    const rid = event.context.reqId || '----'
    const duration = Date.now() - (event.context.startTime || Date.now())
    const status   = getResponseStatus(event)

    let resStr = ''
    if (event.path.startsWith('/sdkapi/peer/') || event.path.startsWith('/sdkapi/ai-proxy/')) {
      resStr = '[中转响应内容不记录]'
    } else if (body) {
      if (typeof body === 'string') {
        resStr = body.length > 1000 ? body.substring(0, 1000) + '... (truncated)' : body
      } else if (typeof body === 'object') {
        const str = JSON.stringify(body)
        resStr = str.length > 1000 ? str.substring(0, 1000) + '... (truncated)' : str
      }
    }

    _orig.log(`│ #${rid} [OUT] ${status} (${duration}ms) | Response: ${resStr}`)
    _orig.log(`└──── #${rid} ────────────────────────────────────\n`)
  })

  // ★ 错误响应：beforeResponse 不触发，需监听 error hook 才能看到 4xx/5xx 的响应
  nitroApp.hooks.hook('error', async (error, event) => {
    try {
      if (!event || !shouldLog(event.path)) return

      const rid = event.context?.reqId || '----'
      const duration = Date.now() - (event.context?.startTime || Date.now())
      const status = error.statusCode || 500
      const resStr = JSON.stringify({
        statusCode: status,
        statusMessage: error.statusMessage || '',
        message: error.message,
        stack: error.stack ? String(error.stack).split('\n')[0] : '',
      })

      _orig.error(`│ #${rid} [OUT] ${status} (${duration}ms) | Error: ${resStr}`)

      // ── 5xx 错误兜底：把响应给客户端的 message 替换为通用文案 ──
      // 4xx 是业务错误（如"验证码错误"），保留原 message 给用户；
      // 5xx 是服务端错误，原 message 可能含 SQL/堆栈/第三方细节，不透传。
      // 真实错误已在上面 resStr 打进 pm2 日志，此处改写不影响日志可见性。
      if (status >= 500) {
        error.message = '服务器内部错误，请稍后重试'
        error.statusMessage = 'Internal Server Error'
      }

      _orig.log(`└──── #${rid} ────────────────────────────────────\n`)
    } catch {
      // 日志自身绝不能再抛错，否则会递归触发 error hook
    }
  })
})
