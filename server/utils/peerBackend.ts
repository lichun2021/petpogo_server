/**
 * peerBackend.ts
 * ──────────────────────────────────────────────────────────────
 * 对方后台（iPet 宠物/硬件管理系统）的所有 HTTP 交互统一放在这里。
 *
 * 基础URL:   PEER_BACKEND_URL (内部通信)
 * 公网URL:   PEER_BACKEND_PUBLIC_URL (前端直连宠物/设备接口用)
 * 认证方式:  token Header (对方颁发的 granwin_token)
 * 内容类型:  application/x-www-form-urlencoded
 *
 * 账号映射规则:
 *   本后台 phone(手机号) → 对方 account({phone}@petpogo.com)
 *
 * 密码生成规则（确定性，无需存库）:
 *   sha256("peer:" + phone + ":" + PEER_BACKEND_SECRET).substring(0, 32)
 * ──────────────────────────────────────────────────────────────
 */

import crypto from 'node:crypto'

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
  granwin_token: string
  refresh_token: string
  endpoint: string       // AWS IoT endpoint，前端直连设备需要
  region: string
  merchantId: number
  account: string
  expiration: number     // granwin_token 有效期（秒），通常 43200 = 12小时
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
  const { url } = getPeerConfig()
  const fullUrl = `${url}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (granwinToken) {
    headers['token'] = granwinToken
  }

  // 打印发出的请求（密码字段脱敏）
  const logParams = { ...params }
  if ('password' in logParams) logParams.password = '***'
  if ('oldPassword' in logParams) logParams.oldPassword = '***'
  if ('newPassword' in logParams) logParams.newPassword = '***'
  console.log(`[PeerBackend] → POST ${fullUrl}`, JSON.stringify(logParams))

  let res: PeerResponse<T>
  try {
    res = await $fetch<PeerResponse<T>>(fullUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        )
      ).toString(),
    })
  } catch (err: any) {
    const msg = err?.data?.tip || err?.data?.message || err?.message || '对方后台服务异常'
    const status = err?.statusCode || err?.response?.status || 503
    const safeParams = { ...params }
    if ('password' in safeParams) safeParams.password = '***'
    if ('oldPassword' in safeParams) safeParams.oldPassword = '***'
    if ('newPassword' in safeParams) safeParams.newPassword = '***'
    console.error(`[PeerBackend] POST ${fullUrl} 失败:`, msg, '| params:', safeParams)
    throw createError({ statusCode: status, message: `[iPet] ${msg}` })
  }

  if (res.code !== 0) {
    const safeParams = { ...params }
    if ('password' in safeParams) safeParams.password = '***'
    if ('oldPassword' in safeParams) safeParams.oldPassword = '***'
    if ('newPassword' in safeParams) safeParams.newPassword = '***'
    console.error(`[PeerBackend] POST ${fullUrl} 业务错误 code=${res.code}:`, res.tip, '| params:', safeParams)
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

  const { url } = getPeerConfig()
  const fullUrl = `${url}/user/register`
  const params = { account, password: generatePeerPassword(), merchantId }

  console.log(`[PeerBackend] → POST ${fullUrl}`, JSON.stringify({ ...params, password: '***' }))

  let res: PeerResponse
  try {
    res = await $fetch<PeerResponse>(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString(),
    })
  } catch (err: any) {
    const msg = err?.data?.tip || err?.data?.message || err?.message || '对方后台服务异常'
    console.error(`[PeerBackend] POST ${fullUrl} 失败:`, msg)
    throw createError({ statusCode: err?.statusCode || 503, message: `[iPet] ${msg}` })
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
    console.error(`[PeerBackend] POST ${fullUrl} 业务错误 code=${res.code}:`, tip)
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
 * 本后台验证通过后，同步调用对方后台获取 granwin_token 及 AWS IoT 凭证。
 *
 * @param phone 本后台手机号
 * @returns 对方后台完整的登录信息（含 granwin_token / refresh_token / AWS凭证）
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
 * 使用 refresh_token 换取新的 granwin_token 及 AWS IoT 凭证。
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
 * @param granwinToken 当前用户的 granwin_token（从 Redis Session 中读取）
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
 * 计算 granwin_token 的 Redis Key（SHA-256，避免 Token 明文存 Redis）
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
