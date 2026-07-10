/**
 * 积分系统工具（批次模型）
 * ─────────────────────────────────────────────────────────
 * 每一笔赠送积分都成为一条独立批次（t_user_points_batch），带自己的 expire_at 到期时间。
 *  - 永久积分（type_code='permanent'）：永不过期，仅付费计划赠送。
 *  - 有期限积分（plan_free/plan_pro/plan_promax/checkin 等）：按 t_points_config.expire_days 到期。
 *
 * 消耗顺序：按到期时间升序扣减（先到期先扣），永久批次（expire_at IS NULL）最后扣。
 * 到期处理：读取余额时惰性失效过期批次（remaining 置 0）。
 *
 * 周期积分发放（核心）：
 *  - 每个计划在 t_plan 配置 grant_period_days（发放周期天数，Free=7 Pro=30 等）。
 *  - 主路径：系统 cron 每天调 /api/internal/grant-scheduled，扫所有到期用户(到 last_grant_at + period_days)
 *    发放一批，用户不在线也照常累计。
 *  - 兜底：用户访问积分时也查一次(ensurePeriodGrant)，防 cron 漏跑；但 cron 是主路径。
 *  - 相对周期：从上次发放时刻起算 N 天，不是固定日历边界，各用户周期不同步。
 * ─────────────────────────────────────────────────────────
 */

// 向后兼容：旧的 points_type 二值映射（仅 admin 手动调整等旧入参用）
export const POINTS_TYPE_WEEKLY = 1
export const POINTS_TYPE_PERMANENT = 2
// 旧 points_type → 新 type_code 的映射
const LEGACY_TYPE_MAP: Record<number, string> = {
  [POINTS_TYPE_WEEKLY]: 'plan_free',
  [POINTS_TYPE_PERMANENT]: 'permanent',
}

const DIRECTION_GAIN = 1
const DIRECTION_SPEND = 2

export interface PointsBatch {
  id: string
  typeCode: string
  remaining: number
  expireAt: string | null
  reason: string | null
}

export interface PointsBalance {
  /** 有期限积分合计 */
  expiring: number
  /** 永久积分合计 */
  permanent: number
  total: number
  /** 有效批次明细（remaining>0） */
  batches: PointsBatch[]
}

/**
 * 取某积分类型的有效期天数（0=永不过期）。
 */
async function getExpireDays(typeCode: string): Promise<number> {
  const db = useDb()
  const [[cfg]]: any = await db.query(
    `SELECT expire_days FROM t_points_config WHERE type_code=? AND status=1`,
    [typeCode]
  )
  return cfg ? Number(cfg.expire_days) || 0 : 0
}

/**
 * 计算批次到期时间字符串（NOW()+expire_days），expireDays=0 返回 null（永不过期）。
 */
function computeExpireAt(expireDays: number): string | null {
  if (!expireDays || expireDays <= 0) return null
  const d = new Date()
  d.setDate(d.getDate() + expireDays)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 惰性失效：把已过期但 remaining>0 的批次置 0。
 */
async function expireOverdueBatches(userId: string | bigint): Promise<void> {
  const db = useDb()
  await db.query(
    `UPDATE t_user_points_batch SET remaining=0
     WHERE user_id=? AND expire_at IS NOT NULL AND expire_at < NOW() AND remaining > 0`,
    [userId]
  )
}

/**
 * 取用户的「有效计划类型」：若 plan_expire_at 已过期则视为 Free(0)。
 * 过期付费用户不再按高额度发放，降级为 Free。
 */
async function getEffectivePlanType(userId: string | bigint): Promise<number> {
  const db = useDb()
  const [[user]]: any = await db.query(
    `SELECT plan_type, plan_expire_at FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })
  const planType = Number(user.plan_type ?? 0)
  // 已过期 → 降级为 Free
  if (user.plan_expire_at && new Date(user.plan_expire_at).getTime() < Date.now()) {
    return 0
  }
  return planType
}

/**
 * 单用户周期积分发放（兜底 + 复用）。
 * 相对周期判断：若 last_grant_at 为空 或 NOW() >= last_grant_at + grant_period_days，则发一批。
 * 这是兜底入口（防 cron 漏跑）；主路径是 grantScheduledPoints() 由 cron 每日批量调用。
 */
export async function ensurePeriodGrant(userId: string | bigint): Promise<void> {
  const db = useDb()

  const [[user]]: any = await db.query(
    `SELECT last_grant_at, plan_type, plan_expire_at FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  // 有效计划（过期则 Free）
  const expired = user.plan_expire_at && new Date(user.plan_expire_at).getTime() < Date.now()
  const effectivePlanType = expired ? 0 : Number(user.plan_type ?? 0)

  const [[plan]]: any = await db.query(
    `SELECT grant_period_days, period_grant_amount, period_grant_type_code FROM t_plan WHERE plan_type=? AND status=1`,
    [effectivePlanType]
  )
  const periodDays = Number(plan?.grant_period_days) || 7
  const amount = Number(plan?.period_grant_amount) || 0

  // 相对周期判断（日期粒度）：仅比较日期，不看时刻。
  // 这样当「发放周期 == 有效期」时（如 Free 7天发/7天到期），
  // 跨过日期边界当天就发，避免精确时刻比较导致的空窗与漂移。
  if (user.last_grant_at) {
    const lastDate = new Date(user.last_grant_at)
    const nextGrantDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + periodDays)
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (todayMidnight < nextGrantDate) return // 本周期日期未到
  }

  if (amount <= 0) {
    // 该计划无周期赠送，仅刷新发放时刻，避免反复查询
    await db.query(`UPDATE t_user SET last_grant_at=NOW() WHERE id=?`, [userId])
    return
  }

  const typeCode = plan?.period_grant_type_code || `plan_free`
  const expireDays = await getExpireDays(typeCode)
  const expireAt = computeExpireAt(expireDays)

  await db.query(
    `INSERT INTO t_user_points_batch (user_id, type_code, granted_amount, remaining, expire_at, reason, ref_type)
     VALUES (?, ?, ?, ?, ?, ?, 'plan_period')`,
    [userId, typeCode, amount, amount, expireAt, `${effectivePlanType === 0 ? 'Free' : '计划'}周期赠送积分`]
  )

  await db.query(`UPDATE t_user SET last_grant_at=NOW() WHERE id=?`, [userId])
}

/**
 * ★ 定时批量发放（cron 主路径）。
 * 扫描所有「到点该发」的用户(last_grant_at 为空 或 >= last_grant_at + 该计划 grant_period_days)，
 * 逐个发放一批周期积分。用户不在线也照常累计。
 *
 * 策略：断登不追溯补发多次 —— 只发当前 1 次，last_grant_at 重置为当下，下个周期重新倒计时。
 * @returns 发放统计 { scanned, granted }
 */
export async function grantScheduledPoints(batchSize = 500): Promise<{ scanned: number; granted: number }> {
  const db = useDb()

  // 取所有待发放用户：last_grant_at 为空，或距上次发放已满周期天数。
  // ★ 日期粒度判定：DATEDIFF(今天, 上次发放日) >= 周期天数。
  //   这样跨过日期边界当天就发，避免精确时刻比较导致的空窗与漂移。
  //   （当「发放周期 == 有效期」时，如 Free 7天发/7天到期，可实现无缝重置效果）
  const [rows]: any = await db.query(
    `SELECT u.id, u.last_grant_at, u.plan_type, u.plan_expire_at,
            COALESCE(p.grant_period_days, 7) AS period_days,
            p.period_grant_amount, p.period_grant_type_code, p.status AS plan_status
     FROM t_user u
     LEFT JOIN t_plan p ON p.plan_type = u.plan_type
     WHERE u.deleted = 0
       AND (
         u.last_grant_at IS NULL
         OR DATEDIFF(CURDATE(), DATE(u.last_grant_at)) >= COALESCE(p.grant_period_days, 7)
       )
     LIMIT ?`,
    [batchSize]
  )

  let granted = 0
  // 预加载所有积分类型的 expire_days，避免逐用户查询
  const [cfgs]: any = await db.query(`SELECT type_code, expire_days FROM t_points_config WHERE status=1`)
  const expireDaysMap: Record<string, number> = {}
  for (const c of cfgs) expireDaysMap[c.type_code] = Number(c.expire_days) || 0

  for (const r of rows) {
    // 有效计划：过期或计划停用 → 降级 Free
    const expired = r.plan_expire_at && new Date(r.plan_expire_at).getTime() < Date.now()
    const effectivePlanType = (expired || r.plan_status !== 1) ? 0 : Number(r.plan_type ?? 0)

    // 若降级了，需重新查 Free 计划配置
    let amount = Number(r.period_grant_amount) || 0
    let typeCode = r.period_grant_type_code || 'plan_free'
    if (effectivePlanType !== Number(r.plan_type ?? 0)) {
      const [[freePlan]]: any = await db.query(
        `SELECT period_grant_amount, period_grant_type_code FROM t_plan WHERE plan_type=0 AND status=1`
      )
      amount = Number(freePlan?.period_grant_amount) || 0
      typeCode = freePlan?.period_grant_type_code || 'plan_free'
    }

    if (amount <= 0) {
      await db.query(`UPDATE t_user SET last_grant_at=NOW() WHERE id=?`, [r.id])
      continue
    }

    const expireDays = expireDaysMap[typeCode] ?? 0
    const expireAt = computeExpireAt(expireDays)

    await db.query(
      `INSERT INTO t_user_points_batch (user_id, type_code, granted_amount, remaining, expire_at, reason, ref_type)
       VALUES (?, ?, ?, ?, ?, ?, 'plan_period')`,
      [r.id, typeCode, amount, amount, expireAt, `${effectivePlanType === 0 ? 'Free' : '计划'}周期赠送积分`]
    )
    await db.query(`UPDATE t_user SET last_grant_at=NOW() WHERE id=?`, [r.id])
    granted++
  }

  return { scanned: rows.length, granted }
}

/**
 * 发放一批积分（签到奖励、购买计划赠送、客服手动调整等）。
 * @param typeCode  积分类型（引用 t_points_config.type_code）
 */
export async function grantPointsBatch(
  userId: string | bigint,
  amount: number,
  typeCode: string,
  reason: string,
  refType?: string,
  refId?: string
): Promise<PointsBalance> {
  if (amount <= 0) throw createError({ statusCode: 400, message: '积分发放数量必须大于0' })
  if (!typeCode) throw createError({ statusCode: 400, message: 'type_code 不能为空' })

  await ensurePeriodGrant(userId)

  const db = useDb()
  const expireDays = await getExpireDays(typeCode)
  const expireAt = computeExpireAt(expireDays)

  await db.query(
    `INSERT INTO t_user_points_batch (user_id, type_code, granted_amount, remaining, expire_at, reason, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, typeCode, amount, amount, expireAt, reason, refType ?? null, refId ?? null]
  )

  await db.query(
    `INSERT INTO t_points_log (user_id, direction, type_code, points_type, amount, balance_after, expire_at, reason, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, DIRECTION_GAIN, typeCode, null, amount, amount, expireAt, reason, refType ?? null, refId ?? null]
  )

  return getPointsBalance(userId)
}

/**
 * 查询积分余额（只读，内部先做每周发放 + 惰性失效）。
 * 返回批次明细：expiring(有期限合计) / permanent(永久合计) / total / batches。
 */
export async function getPointsBalance(userId: string | bigint): Promise<PointsBalance> {
  await ensurePeriodGrant(userId)
  await expireOverdueBatches(userId)

  const db = useDb()
  const [batches]: any = await db.query(
    `SELECT id, type_code, remaining, expire_at, reason
     FROM t_user_points_batch
     WHERE user_id=? AND remaining > 0
     ORDER BY (expire_at IS NULL) ASC, expire_at ASC, id ASC`,
    [userId]
  )

  let expiring = 0
  let permanent = 0
  const batchList: PointsBatch[] = (batches || []).map((b: any) => {
    const isPermanent = b.expire_at === null
    const remaining = Number(b.remaining) || 0
    if (isPermanent) permanent += remaining
    else expiring += remaining
    return {
      id: String(b.id),
      typeCode: b.type_code,
      remaining,
      expireAt: b.expire_at,
      reason: b.reason,
    }
  })

  return { expiring, permanent, total: expiring + permanent, batches: batchList }
}

/**
 * 消耗积分：按到期时间升序扣减（先到期先扣，永久批次最后扣）。总量不足则抛 402。
 */
export async function spendPoints(
  userId: string | bigint,
  amount: number,
  reason: string,
  refType?: string,
  refId?: string
): Promise<PointsBalance> {
  if (amount <= 0) throw createError({ statusCode: 400, message: '积分消耗数量必须大于0' })

  await ensurePeriodGrant(userId)
  await expireOverdueBatches(userId)

  const db = useDb()
  // 查有效批次，按到期升序（永久排最后）
  const [batches]: any = await db.query(
    `SELECT id, type_code, remaining, expire_at
     FROM t_user_points_batch
     WHERE user_id=? AND remaining > 0
     ORDER BY (expire_at IS NULL) ASC, expire_at ASC, id ASC
     FOR UPDATE`,
    [userId]
  )

  const available = (batches || []).reduce((s: number, b: any) => s + (Number(b.remaining) || 0), 0)
  if (available < amount) {
    throw createError({
      statusCode: 402,
      message: `积分不足，当前剩余 ${available} 分，需要 ${amount} 分`,
      data: { expiring: available },
    })
  }

  let remainingToSpend = amount
  for (const b of batches) {
    if (remainingToSpend <= 0) break
    const batchRemaining = Number(b.remaining) || 0
    const take = Math.min(batchRemaining, remainingToSpend)
    const after = batchRemaining - take
    await db.query(
      `UPDATE t_user_points_batch SET remaining=? WHERE id=?`,
      [after, b.id]
    )
    await db.query(
      `INSERT INTO t_points_log (user_id, direction, type_code, points_type, amount, balance_after, expire_at, reason, ref_type, ref_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, DIRECTION_SPEND, b.type_code, null, take, after, b.expire_at, reason, refType ?? null, refId ?? null]
    )
    remainingToSpend -= take
  }

  return getPointsBalance(userId)
}

/**
 * 旧版发放接口（向后兼容）：pointsType(1周/2永久) → 映射到默认 type_code。
 * 新代码请直接使用 grantPointsBatch。
 */
export async function grantPoints(
  userId: string | bigint,
  amount: number,
  pointsType: number,
  reason: string,
  refType?: string,
  refId?: string
): Promise<PointsBalance> {
  const typeCode = LEGACY_TYPE_MAP[pointsType] || 'plan_free'
  return grantPointsBatch(userId, amount, typeCode, reason, refType, refId)
}
