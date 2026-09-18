/**
 * peerBackend.ts
 * ──────────────────────────────────────────────────────────────
 * 对方后台（iPet 宠物/硬件管理系统）的所有 HTTP 交互统一放在这里。
 *
 * 基础URL:   PEER_BACKEND_URL (内部通信)
 * 公网URL:   PEER_BACKEND_PUBLIC_URL (前端直连宠物/设备接口用)
 * 认证方式:  token Header (对方颁发的 ipet_token)
 * 账号接口使用表单；SDK 中转同时支持 GET、表单和 JSON。
 *
 * 账号映射规则:
 *   本后台 phone(手机号) → 对方 account({phone}@qq.com)
 *
 * 账号业务保持原有固定密码规则。所有上游 HTTP 请求集中在本文件。
 * ──────────────────────────────────────────────────────────────
 */

import crypto from 'node:crypto'
import { createError } from 'h3'

// ── 类型定义 ──────────────────────────────────────────────────

/** 对方后台 Pool 信息（Cognito Identity） */
export interface PeerPool {
  identifier: string
  identityId: string
  identityPoolId: string
  token: string
}

/** 对方后台 AWS 临时凭证 */
export interface PeerProof {
  accessKeyId: string
  secretKey: string
  sessionToken: string
  sessionExpiration: number
}

/** 对方后台登录/刷新成功后的完整响应 info */
export interface PeerAuthInfo {
  ipet_token: string
  refresh_token: string
  endpoint: string       // AWS IoT endpoint，前端直连设备需要
  region: string
  merchantId: number
  account: string
  expiration: number     // ipet_token 有效期（秒），通常 43200 = 12小时
  pool: PeerPool
  proof: PeerProof
}

/** 对方后台统一响应格式 */
interface PeerResponse<T = any> {
  code: number
  tip: string
  info?: T
}

// ── 内部工具 ──────────────────────────────────────────────────

function getPeerConfig() {
  const config = useRuntimeConfig()
  const url = config.peerBackendUrl
  if (!url) {
    throw createError({ statusCode: 503, message: '对方后台地址未配置 (PEER_BACKEND_URL)' })
  }
  return {
    url,
    merchantId: Number(config.peerBackendMerchantId) || 1,
    secret: config.peerBackendSecret || '',
    publicUrl: config.peerBackendPublicUrl || url,
  }
}

export interface PeerRequestOptions {
  method: 'GET' | 'POST'
  encoding: 'query' | 'form' | 'json' | 'empty'
  params?: Record<string, string | number>
  token?: string
}

/**
 * 唯一上游 HTTP 出口。path 只能由服务端账号方法或接口清单提供。
 * 原始 JSON 文本交给中转层，避免长整数 ID 被 JS 解析后截断。
 * 不自动重试或跟随重定向，避免重复控制设备或将 token 发送到其他地址。
 */
export async function peerRequest(path: string, options: PeerRequestOptions) {
  const { url } = getPeerConfig()
  if (!/^\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*$/.test(path)) {
    throw createError({ statusCode: 500, message: 'Peer 接口路径配置错误' })
  }
  const target = new URL(`${url.replace(/\/+$/, '')}${path}`)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw createError({ statusCode: 503, message: 'Peer 上游地址配置错误' })
  }
  const headers: Record<string, string> = { Accept: '*/*' }
  if (options.token) headers.token = options.token
  const params = options.params ?? {}
  const form = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))
  let body: string | undefined
  if (options.encoding === 'query') target.search = form.toString()
  if (options.encoding === 'form') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = form.toString()
  } else if (options.encoding === 'json') {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(params)
  }
  const configuredTimeout = Number(useRuntimeConfig().peerBackendTimeoutMs)
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 20000
  const signal = AbortSignal.timeout(timeout)
  try {
    const response = await fetch(target, { method: options.method, headers, body, signal, redirect: 'manual' })
    const text = await response.text()
    if (response.status >= 300 && response.status < 400) {
      throw createError({ statusCode: 502, message: 'Peer 上游返回了重定向' })
    }
    // 仅检查 JSON 格式，不重新序列化；错误页不能作为成功 JSON 返回给 App。
    try { JSON.parse(text) } catch {
      throw createError({ statusCode: 502, message: 'Peer 上游响应格式异常' })
    }
    return { status: response.status, body: text }
  } catch (error: any) {
    if (signal.aborted) throw createError({ statusCode: 504, message: 'Peer 服务响应超时，请稍后重试' })
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, message: 'Peer 服务暂时不可用，请稍后重试' })
  }
}

/**
 * 账号格式：手机号 + @qq.com（对方后台要求邮箱格式）
 */
export function phoneToAccount(phone: string): string {
  return `${phone}@qq.com`
}

/**
 * 对方后台统一使用固定默认密码（所有用户一致）
 */
export function generatePeerPassword(): string {
  return '12345678'
}

/**
 * 对方后台通用 HTTP 请求
 * Content-Type 固定为 application/x-www-form-urlencoded
 */
async function peerFetch<T = any>(
  path: string,
  params: Record<string, string | number>,
  granwinToken?: string
): Promise<T> {
  const response = await peerRequest(path, {
    method: 'POST', encoding: 'form', params, token: granwinToken,
  })
  const res = JSON.parse(response.body) as PeerResponse<T>
  if (response.status >= 400) {
    throw createError({ statusCode: response.status, message: `[iPet] ${res.tip || '对方后台服务异常'}` })
  }

  if (res.code !== 0) {
    console.error(`[PeerBackend] POST ${path} 业务错误 code=${res.code}`)
    throw createError({ statusCode: 400, message: `[iPet] ${res.tip}` })
  }

  return (res.info ?? res) as T
}

// ── 对外 API ──────────────────────────────────────────────────

/**
 * 1.1 用户注册
 * 本后台新用户首次登录时，同步在对方后台创建账号。
 *
 * @param phone 本后台手机号
 */
export async function peerRegister(phone: string): Promise<void> {
  const { merchantId } = getPeerConfig()
  const account = `${phone}@qq.com`

  const response = await peerRequest('/user/register', {
    method: 'POST', encoding: 'form',
    params: { account, password: generatePeerPassword(), merchantId },
  })
  const res = JSON.parse(response.body) as PeerResponse
  if (response.status >= 400) {
    throw createError({ statusCode: response.status, message: `[iPet] ${res.tip || '对方后台服务异常'}` })
  }

  // code=1 且含「已注册」→ 幂等成功，静默跳过
  if (res.code !== 0) {
    const tip: string = res.tip ?? ''
    if (
      tip.includes('已注册') || tip.includes('已存在') ||
      tip.includes('already') || tip.includes('exist') || tip.includes('duplicate')
    ) {
      console.log(`[PeerBackend] /user/register: ${account} 已注册，跳过`)
      return
    }
    console.error(`[PeerBackend] POST /user/register 业务错误 code=${res.code}`)
    throw createError({ statusCode: 400, message: `[iPet] ${tip}` })
  }
}

/**
 * 1.1b 确保用户在对方后台存在（注册 or 已存在均视为成功）
 * peerRegister 内部已处理「已注册」情况，此处直接调用即可。
 */
export async function peerEnsureRegistered(phone: string): Promise<void> {
  await peerRegister(phone)
}

/**
 * 1.2 用户登录
 * 本后台验证通过后，同步调用对方后台获取 ipet_token 及 AWS IoT 凭证。
 *
 * @param phone 本后台手机号
 * @returns 对方后台完整的登录信息（含 ipet_token / refresh_token / AWS凭证）
 */
export async function peerLogin(phone: string): Promise<PeerAuthInfo> {
  const { merchantId } = getPeerConfig()
  return peerFetch<PeerAuthInfo>('/user/login', {
    account: `${phone}@qq.com`,
    password: generatePeerPassword(),
    merchantId,
  })
}

/**
 * 1.3 刷新 Token
 * 使用 refresh_token 换取新的 ipet_token 及 AWS IoT 凭证。
 *
 * @param refreshToken 登录时返回的 refresh_token
 * @returns 与登录相同结构的完整信息
 */
export async function peerRefreshToken(refreshToken: string): Promise<PeerAuthInfo> {
  return peerFetch<PeerAuthInfo>('/user/refresh/token', {
    refreshToken,
  })
}

/**
 * 1.5 同步用户资料更新
 * 本后台用户修改昵称等信息时，同步更新对方后台。
 * 字段映射：nickname → name（对方后台无 avatar/bio/birthday 字段）
 *
 * @param granwinToken 当前用户的 ipet_token（从 Redis Session 中读取）
 * @param params       要同步的字段
 */
export async function peerSyncProfile(
  granwinToken: string,
  params: { name?: string; sex?: number; age?: number }
): Promise<void> {
  const body: Record<string, string | number> = {}
  if (params.name !== undefined) body.name = params.name
  if (params.sex !== undefined) body.sex = params.sex
  if (params.age !== undefined) body.age = params.age
  if (Object.keys(body).length === 0) return
  await peerFetch('/user/info/update', body, granwinToken)
}
// ── Redis Session 工具 ────────────────────────────────────────

/**
 * 计算 ipet_token 的 Redis Key（SHA-256，避免 Token 明文存 Redis）
 */
export function tokenSessionKey(granwinToken: string): string {
  const hash = crypto.createHash('sha256').update(granwinToken).digest('hex')
  return `peer_token:${hash}`
}

/**
 * 获取对方后台的公网地址（返回给前端，前端直连宠物/设备接口）
 */
export function getPeerPublicUrl(): string {
  return getPeerConfig().publicUrl
}
