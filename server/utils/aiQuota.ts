/**
 * AI 使用量管理工具
 * - 普通用户：每日 10 次（ai_daily_limit = 10）
 * - VIP 用户：不限量（ai_daily_limit = -1）
 */

const VIP_DAILY_LIMIT = -1   // 不限制
const DEFAULT_DAILY_LIMIT = 10

interface AiQuotaResult {
  allowed: boolean
  used: number
  limit: number        // -1 表示不限
  remaining: number    // -1 表示不限
}

/**
 * 检查用户今日 AI 使用量，若未超限则自动 +1
 * @returns AiQuotaResult
 */
export async function checkAndIncrAiUsage(userId: string | bigint): Promise<AiQuotaResult> {
  const db = useDb()
  const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD

  // 查用户 VIP 状态和 AI 限额
  const [[user]]: any = await db.query(
    `SELECT vip_status, vip_expire_at, ai_daily_limit
     FROM t_user WHERE id = ? AND deleted = 0`,
    [userId]
  )

  if (!user) throw new Error('用户不存在')

  // 判断 VIP 是否有效
  const isVip = user.vip_status === 1 &&
    (user.vip_expire_at === null || new Date(user.vip_expire_at) > new Date())

  const limit: number = isVip ? VIP_DAILY_LIMIT : (user.ai_daily_limit ?? DEFAULT_DAILY_LIMIT)

  // 查今日使用量
  const [[usage]]: any = await db.query(
    `SELECT used_count FROM t_ai_usage WHERE user_id = ? AND use_date = ?`,
    [userId, today]
  )
  const used = usage?.used_count ?? 0

  // 是否超限
  if (limit !== -1 && used >= limit) {
    return { allowed: false, used, limit, remaining: 0 }
  }

  // 原子 +1（INSERT ... ON DUPLICATE KEY UPDATE）
  await db.query(
    `INSERT INTO t_ai_usage (user_id, use_date, used_count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE used_count = used_count + 1`,
    [userId, today]
  )

  const newUsed = used + 1
  return {
    allowed: true,
    used: newUsed,
    limit,
    remaining: limit === -1 ? -1 : limit - newUsed,
  }
}

/**
 * 查询用户今日 AI 使用量（不消耗次数）
 */
export async function getAiUsageInfo(userId: string | bigint): Promise<AiQuotaResult> {
  const db = useDb()
  const today = new Date().toISOString().slice(0, 10)

  const [[user]]: any = await db.query(
    `SELECT vip_status, vip_expire_at, ai_daily_limit FROM t_user WHERE id = ?`,
    [userId]
  )
  if (!user) throw new Error('用户不存在')

  const isVip = user.vip_status === 1 &&
    (user.vip_expire_at === null || new Date(user.vip_expire_at) > new Date())
  const limit: number = isVip ? VIP_DAILY_LIMIT : (user.ai_daily_limit ?? DEFAULT_DAILY_LIMIT)

  const [[usage]]: any = await db.query(
    `SELECT used_count FROM t_ai_usage WHERE user_id = ? AND use_date = ?`,
    [userId, today]
  )
  const used = usage?.used_count ?? 0

  return {
    allowed: limit === -1 || used < limit,
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
  }
}
