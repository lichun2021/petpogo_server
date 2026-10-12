/** 日志显式记录北京时间和时区，不依赖服务器操作系统时区。 */
export function requestLogTime(now = Date.now()): string {
  return new Date(now + 8 * 3600000).toISOString().replace('Z', '+08:00')
}

/** 时间独立放在行首；正文仍为单行JSON，便于检索且避免换行注入。 */
export function formatRequestLog(record: Record<string, unknown>, now = Date.now()): string {
  const time = requestLogTime(now).slice(0, 19).replace('T', ' ')
  return `[${time}] ${JSON.stringify(record)}`
}

// 只输出固定白名单文案，不记录任意异常原文（可能含SQL、token或个人信息）。
const reasons: Record<string, [string, string]> = {
  '未登录，请先登录': ['AUTH_TOKEN_MISSING', '请求未携带登录凭证'],
  'Token 已过期，请重新登录': ['AUTH_SESSION_MISSING', '本地会话不存在：可能已过期、退出或被清理'],
  'Session 数据异常，请重新登录': ['AUTH_SESSION_INVALID', '本地会话数据异常'],
  '登录凭证已失效，请重新登录': ['AUTH_CREDENTIAL_CHANGED', '账号凭证版本已变更，旧会话失效'],
  '账号不存在': ['AUTH_USER_NOT_FOUND', '本地未找到有效账号'],
  '账号已被封禁，无法执行此操作': ['AUTH_USER_DISABLED', '账号已被禁用'],
  '请重新登录': ['AUTH_REFRESH_PROOF_MISSING', '刷新凭证记录不存在或已过期'],
  '登录凭证已失效': ['AUTH_REFRESH_REVOKED', '刷新凭证失效：账号状态或凭证版本不匹配'],
  'refreshToken 不能为空': ['AUTH_REFRESH_TOKEN_MISSING', '请求未提供刷新凭证'],
  '刷新返回凭证格式异常': ['AUTH_REFRESH_RESPONSE_INVALID', '对方刷新响应缺少有效登录凭证或有效期，未保存新会话'],
  '刷新返回账号与本地账号不匹配': ['AUTH_REFRESH_ACCOUNT_MISMATCH', '对方刷新返回的账号与本地刷新凭证所属账号不一致，未保存新会话'],
  '缺少请求签名 (Missing signature headers)': ['SIGNATURE_MISSING', '请求缺少SDKAPI签名头'],
  '无效的时间戳格式': ['SIGNATURE_TIMESTAMP_INVALID', '签名时间戳格式错误'],
  '请求时间戳过期或误差过大 (Request expired)': ['SIGNATURE_EXPIRED', '签名时间戳与服务器时间相差超过允许范围'],
  '请求签名验证失败 (Invalid signature)': ['SIGNATURE_INVALID', '请求签名校验失败'],
  '缺少 nonce 防重放标识': ['SIGNATURE_NONCE_MISSING', '请求缺少有效nonce'],
  '请求已处理，请勿重放': ['SIGNATURE_REPLAYED', 'nonce重复，请使用新的请求签名'],
}
export function requestErrorSummary(error: any, stage?: string) {
  if (stage === 'peer_refresh') return { code: 'AUTH_REFRESH_UPSTREAM_FAILED', reason: '对方后台刷新凭证失败，请按requestId查看peer请求日志' }
  if (stage === 'local_account_lookup' && error?.message === '账号不存在') return { code: 'AUTH_REFRESH_ACCOUNT_NOT_FOUND', reason: '对方刷新成功，但返回账号未匹配本地有效用户' }
  const known = reasons[error?.message]
  return known ? { code: known[0], reason: known[1] } : undefined
}
export function httpErrorReason(status: number): string | undefined {
  if (status === 401) return '身份校验未通过，具体原因未分类'
  if (status === 403) return '访问被拒绝，具体原因未分类'
  if (status === 404) return '接口或业务资源不存在，具体原因未分类'
  if (status >= 500) return '服务处理失败，请结合错误码和调用阶段排查'
  if (status >= 400) return '请求未完成，请检查参数及业务状态'
}
