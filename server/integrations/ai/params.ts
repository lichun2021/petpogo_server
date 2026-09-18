import { createError } from 'h3'
import type { AiEndpoint } from './endpoints.ts'
import type { AiParams } from '../../utils/aiBackend.ts'

export function validateAiParams(endpoint: AiEndpoint, input: unknown, phone: string): AiParams {
  const fail = (message: string): never => { throw createError({ statusCode: 400, message }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('请求参数必须为对象')
  const params: AiParams = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!endpoint.fields.includes(key)) fail(`不支持的参数：${key}`)
    if (value == null) continue
    // 唯一数组字段；保留 JSON 类型，不把 boolean/数组转成表单字符串。
    if (key === 'repeat_weekdays') {
      if (!Array.isArray(value) || !value.length || value.some(day => !Number.isInteger(day) || day < 1 || day > 7)) fail('repeat_weekdays 必须为 1–7 的非空整数数组')
      params[key] = [...new Set(value as number[])]
    } else if (key === 'enabled') {
      if (typeof value !== 'boolean') fail('enabled 必须为布尔值')
      params[key] = value as boolean
    } else if (key === 'daily_analysis_count') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) fail('daily_analysis_count 必须为正整数')
      params[key] = value as number
    } else {
      if (typeof value !== 'string') fail(`${key} 必须为字符串，ID 请勿使用数值`)
      params[key] = value as string
    }
  }
  for (const key of endpoint.required) {
    if (params[key] === undefined || (typeof params[key] === 'string' && !String(params[key]).trim())) fail(`${key} 不能为空`)
  }
  if (endpoint.fields.includes('account')) {
    if (params.account !== undefined && params.account !== phone) throw createError({ statusCode: 403, message: 'account 与当前登录账号不一致' })
    params.account = phone
  }
  if (params.period && !['day', 'week', 'month'].includes(String(params.period))) fail('period 必须为 day/week/month')
  if (params.date !== undefined) {
    const date = String(params.date)
    const parsed = new Date(`${date}T00:00:00+08:00`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== date) fail('date 必须为有效的 YYYY-MM-DD 日期')
  }
  for (const field of ['effective_start_time', 'effective_end_time']) {
    if (params[field] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(params[field]))) fail(`${field} 必须为 HH:MM`)
  }
  if (params.url !== undefined) {
    try {
      const url = new URL(String(params.url))
      const config = useRuntimeConfig()
      const hosts = String(config.aiMediaAllowedHosts || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
      if (config.public?.ossCdnBaseUrl) hosts.push(new URL(String(config.public.ossCdnBaseUrl)).hostname.toLowerCase())
      // 下载发生在 AI 服务上，不能让客户端借应用凭证要求它访问内网地址。
      if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.includes(url.hostname.toLowerCase())) {
        fail('素材 URL 必须使用已配置的 HTTPS 素材域名')
      }
    } catch { fail('素材 URL 无效') }
  }
  return params
}
