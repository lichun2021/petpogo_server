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
  path.startsWith('/sdkapi/') || path.startsWith('/api/')

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    if (!shouldLog(event.path)) return

    event.context.startTime = Date.now()

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

    _orig.log(`\n┌─── [API 请求] ${_ts()} ──────────────────────`)
    _orig.log(`│ [IN] ${event.method} ${event.path}${queryStr}${bodyStr}`)
  })

  nitroApp.hooks.hook('beforeResponse', async (event, { body }) => {
    if (!shouldLog(event.path)) return

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

    _orig.log(`│ [OUT] ${status} (${duration}ms) | Response: ${resStr}`)
    _orig.log(`└────────────────────────────────────────────\n`)
  })
})

