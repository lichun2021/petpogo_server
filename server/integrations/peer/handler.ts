import {
  createError, defineEventHandler, getHeader, getQuery, readBody,
  send, setHeader, setResponseStatus,
} from 'h3'
import { requireAuth } from '../../utils/auth.ts'
import { peerRequest } from '../../utils/peerBackend.ts'
import { peerEndpoints, type PeerEndpoint } from './endpoints.ts'

export function validatePeerParams(endpoint: PeerEndpoint, input: unknown): Record<string, string | number> {
  if (input == null) input = {}
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw createError({ statusCode: 400, message: '请求参数必须为对象' })
  }
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!endpoint.fields.includes(key)) {
      throw createError({ statusCode: 400, message: `不支持的参数：${key}` })
    }
    if (value == null) continue
    if ((typeof value !== 'string' && typeof value !== 'number') ||
        (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))))) {
      throw createError({ statusCode: 400, message: `${key} 必须为字符串或安全数值，长 ID 请使用字符串` })
    }
    params[key] = value
  }
  const present = (key: string) => params[key] !== undefined && String(params[key]).trim() !== ''
  for (const key of endpoint.required) {
    if (!present(key)) throw createError({ statusCode: 400, message: `${key} 不能为空` })
  }
  if (endpoint.oneOf && !endpoint.oneOf.some(present)) {
    throw createError({ statusCode: 400, message: `至少提供一个参数：${endpoint.oneOf.join(' / ')}` })
  }
  if (endpoint.path === '/pet/position') params.lang ??= 'zh'
  if (['/device/share/push/add', '/pet/share/add'].includes(endpoint.path)) params.type ??= '3'
  if (['/pet/share/mylist', '/pet/share/withme'].includes(endpoint.path)) {
    params.pageNo ??= 1
    params.pageSize ??= 20
    for (const key of ['pageNo', 'pageSize']) {
      if (!/^\d+$/.test(String(params[key])) || !Number.isSafeInteger(Number(params[key])) || Number(params[key]) < 1) {
        throw createError({ statusCode: 400, message: `${key} 必须为正整数` })
      }
    }
  }
  if (endpoint.path === '/pet/sound/play') {
    const volume = Number(params.volume ?? 15)
    if (!Number.isInteger(volume) || volume < 0 || volume > 21) {
      throw createError({ statusCode: 400, message: 'volume 必须为 0–21 的整数' })
    }
    params.volume = volume
  }
  if (endpoint.path === '/device/shadow/update') {
    try {
      const shadow = JSON.parse(String(params.data))
      if (!shadow || typeof shadow !== 'object' || Array.isArray(shadow)) throw new Error()
    } catch {
      throw createError({ statusCode: 400, message: 'data 必须为 JSON 对象编码后的字符串' })
    }
  }
  return params
}

export const peerProxyHandler = defineEventHandler(async (event) => {
  const path = event.path.split('?')[0].slice('/sdkapi/peer'.length)
  const endpoint = peerEndpoints.find(item => item.path === path)
  if (!endpoint) throw createError({ statusCode: 404, message: 'Peer 接口不存在' })
  if (event.method !== endpoint.method) {
    setHeader(event, 'Allow', endpoint.method)
    throw createError({ statusCode: 405, message: '请求方法不支持' })
  }
  let token: string | undefined
  if (!endpoint.public) {
    // 沿用本地登录/封禁检查；上游使用同一 ipet_token 校验所有权与分享权限。
    // 不使用本地宠物表判断 Peer 资源权限，两套 ID 和共享关系不等价。
    await requireAuth(event)
    token = getHeader(event, 'authorization')?.replace('Bearer ', '').trim()
  }
  let input: unknown
  if (endpoint.method === 'GET') {
    input = getQuery(event)
  } else {
    const contentType = (getHeader(event, 'content-type') || '').split(';')[0].trim().toLowerCase()
    if (contentType && !['application/json', 'application/x-www-form-urlencoded'].includes(contentType)) {
      throw createError({ statusCode: 415, message: '请使用 JSON 或表单请求体' })
    }
    input = await readBody(event)
  }
  const params = validatePeerParams(endpoint, input)
  const response = await peerRequest(endpoint.path, { ...endpoint, params, token })
  setResponseStatus(event, response.status)
  setHeader(event, 'Cache-Control', 'no-store')
  // 不传递上游 cookie/重定向等响应头，也不对 JSON 做解析后再序列化。
  return send(event, response.body, 'application/json; charset=utf-8')
})
