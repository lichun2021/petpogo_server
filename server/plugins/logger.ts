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

    let bodyStr = ''
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) {
      try {
        if (!event.path.includes('/upload')) {
          const body = await readBody(event)
          if (body) bodyStr = ` | Body: ${JSON.stringify(body)}`
        } else {
          bodyStr = ` | Body: [FormData/File]`
        }
      } catch (e) { /* 忽略无法解析的 body */ }
    }

    const queryStr = Object.keys(getQuery(event)).length
      ? ` | Query: ${JSON.stringify(getQuery(event))}`
      : ''

    _orig.log(`\n┌─── [API 请求] ${_ts()} #${rid} ──────────────────────`)
    _orig.log(`│ #${rid} [IN] ${event.method} ${event.path}${queryStr}${bodyStr}`)
  })

  // 正常响应：打印 [OUT]（beforeResponse 在抛错时不触发）
  nitroApp.hooks.hook('beforeResponse', async (event, { body }) => {
    if (!shouldLog(event.path)) return

    const rid = event.context.reqId || '----'
    const duration = Date.now() - (event.context.startTime || Date.now())
    const status   = getResponseStatus(event)

    let resStr = ''
    if (body) {
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
      _orig.log(`└──── #${rid} ────────────────────────────────────\n`)
    } catch {
      // 日志自身绝不能再抛错，否则会递归触发 error hook
    }
  })
})

