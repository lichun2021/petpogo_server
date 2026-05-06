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

    console.log(`\n┌─── [API 请求] ─────────────────────────────`)
    console.log(`│ [IN] ${event.method} ${event.path}${queryStr}${bodyStr}`)
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

    console.log(`│ [OUT] ${status} (${duration}ms) | Response: ${resStr}`)
    console.log(`└────────────────────────────────────────────\n`)
  })
})
