import { createError, setHeader, type H3Event } from 'h3'

export const PROXY_BODY_LIMIT = 128 * 1024
export const PROXY_RESPONSE_LIMIT = 4 * 1024 * 1024

// 在收包时限量，不等待无限 body 读完；rawBody 是 h3 支持的缓存入口。
export async function readProxyBody(event: H3Event) {
  const req = event.node.req
  const cached = (req as typeof req & { rawBody?: Buffer }).rawBody
  if (Buffer.isBuffer(cached)) {
    if (cached.length > PROXY_BODY_LIMIT) throw createError({ statusCode: 413, message: '请求体超过 128 KiB' })
    return cached
  }
  const rejectBody = () => {
    req.pause()
    setHeader(event, 'Connection', 'close')
    event.node.res.once('finish', () => req.destroy())
  }
  if (Number(req.headers['content-length']) > PROXY_BODY_LIMIT) {
    rejectBody()
    throw createError({ statusCode: 413, message: '请求体超过 128 KiB' })
  }
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted)
    }
    const fail = (statusCode: number, message: string) => {
      cleanup(); rejectBody(); reject(createError({ statusCode, message }))
    }
    const onError = () => fail(400, '读取请求体失败')
    const onAborted = () => fail(400, '请求已取消')
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > PROXY_BODY_LIMIT) return fail(413, '请求体超过 128 KiB')
      chunks.push(chunk)
    }
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks, size)) }
    const timer = setTimeout(() => fail(408, '请求体读取超时'), 10000)
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onAborted)
    if (req.readableEnded) onEnd()
  })
  ;(req as typeof req & { rawBody?: Buffer }).rawBody = body
  return body
}

// 同时限制解压后的上游正文，避免上游异常撑满中转内存；SSE 使用流式 pipeline。
export async function readProxyResponse(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return Buffer.concat(chunks, size).toString('utf8')
      size += value.byteLength
      if (size > PROXY_RESPONSE_LIMIT) {
        await reader.cancel()
        throw createError({ statusCode: 502, message: '上游响应超过 4 MiB 限制' })
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
}
