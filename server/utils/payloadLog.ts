import { parseResourceJson } from '../integrations/shared/json'

/** 保留完整业务结构；凭证字段脱敏，嵌套 JSON 字符串也按相同规则处理。 */
export function redactLogPayload(value: unknown, key = ''): unknown {
  const field = key.replace(/[-_]/g, '').toLowerCase()
  const revealToken = field.includes('token') && process.env.LOG_REDACT_TOKENS !== 'true'
  if (!revealToken && (/password|passwd|token|secret|authorization|cookie|signature|credential|accesskey|privatekey|usersig/.test(field) ||
      ['proof', 'smscode', 'verifycode', 'verificationcode', 'nonce'].includes(field) ||
      (field === 'code' && typeof value === 'string'))) return '[REDACTED]'
  if (Array.isArray(value)) return value.map(item => redactLogPayload(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactLogPayload(item, name)]))
  }
  if (typeof value === 'string') {
    if (/^\s*[\[{]/.test(value)) {
      try { return redactLogPayload(parseResourceJson(value)) } catch { return '[无法解析的嵌套内容]' }
    }
    // 下载和音视频 WebSocket 地址的查询参数可能携带临时访问凭证。
    return value.replace(/(?:https?|wss?):\/\/[^\s"<>]+/g, url => url.split(/[?#]/)[0])
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
  }
  return value
}

export function peerResponseLogPayload(text: string): unknown {
  try { return redactLogPayload(parseResourceJson(text)) }
  catch { return { omitted: '上游返回非JSON正文，避免输出错误页中的凭证', bytes: Buffer.byteLength(text) } }
}
