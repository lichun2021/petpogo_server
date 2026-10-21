/** 只识别本项目约定的手机号与手机号@qq.com，不截取任意邮箱用户名。 */
export function peerAccountToPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(1[3-9]\d{9})(?:@qq\.com)?$/i.exec(value.trim())
  return match?.[1] ?? null
}
