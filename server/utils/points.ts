/**
 * 积分系统工具
 * ─────────────────────────────────────────────────────────
 * 积分分两种：
 *  - 周积分(points_weekly)：到期积分，每周一按用户当前计划(t_plan.weekly_points_grant)重置
 *  - 永久积分(points_permanent)：不过期
 *
 * 消耗顺序：优先扣周积分，不足部分扣永久积分。
 * 周积分重置采用惰性策略：读取/消费积分时才检查是否跨周，跨周则重置为新一周额度。
 * ─────────────────────────────────────────────────────────
 */

export const POINTS_TYPE_WEEKLY = 1
export const POINTS_TYPE_PERMANENT = 2

const DIRECTION_GAIN = 1
const DIRECTION_SPEND = 2

export interface PointsBalance {
  weekly: number
  permanent: number
  total: number
}

// 本周一（YYYY-MM-DD），周一为一周起点
function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=周日 1=周一 ... 6=周六
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  return monday.toISOString().slice(0, 10)
}

/**
 * 惰性重置周积分：若用户 points_week_start 早于本周一，
 * 按其当前计划(t_plan.weekly_points_grant)重置周积分并更新 points_week_start。
 */
async function ensureWeeklyReset(userId: string | bigint): Promise<void> {
  const db = useDb()
  const weekStart = currentWeekStart()

  const [[user]]: any = await db.query(
    `SELECT plan_type, points_week_start FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  const needsReset = !user.points_week_start ||
    new Date(user.points_week_start).toISOString().slice(0, 10) < weekStart
  if (!needsReset) return

  const [[plan]]: any = await db.query(
    `SELECT weekly_points_grant FROM t_plan WHERE plan_type=? AND status=1`,
    [user.plan_type ?? 0]
  )
  const grant = plan?.weekly_points_grant ?? 0

  await db.query(
    `UPDATE t_user SET points_weekly=?, points_week_start=? WHERE id=?`,
    [grant, weekStart, userId]
  )
}

/**
 * 查询积分余额（只读，内部先做惰性重置）
 */
export async function getPointsBalance(userId: string | bigint): Promise<PointsBalance> {
  await ensureWeeklyReset(userId)

  const db = useDb()
  const [[user]]: any = await db.query(
    `SELECT points_weekly, points_permanent FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  const weekly = user.points_weekly ?? 0
  const permanent = user.points_permanent ?? 0
  return { weekly, permanent, total: weekly + permanent }
}

/**
 * 消耗积分：优先扣周积分，不足部分扣永久积分。总量不足则抛 402。
 */
export async function spendPoints(
  userId: string | bigint,
  amount: number,
  reason: string,
  refType?: string,
  refId?: string
): Promise<PointsBalance> {
  if (amount <= 0) throw createError({ statusCode: 400, message: '积分消耗数量必须大于0' })

  await ensureWeeklyReset(userId)

  const db = useDb()
  const [[user]]: any = await db.query(
    `SELECT points_weekly, points_permanent FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  const weekly = user.points_weekly ?? 0
  const permanent = user.points_permanent ?? 0
  if (weekly + permanent < amount) {
    throw createError({
      statusCode: 402,
      message: `积分不足，当前剩余 ${weekly + permanent} 分，需要 ${amount} 分`,
      data: { weekly, permanent },
    })
  }

  const spendWeekly = Math.min(weekly, amount)
  const spendPermanent = amount - spendWeekly

  await db.query(
    `UPDATE t_user SET points_weekly = points_weekly - ?, points_permanent = points_permanent - ? WHERE id=?`,
    [spendWeekly, spendPermanent, userId]
  )

  if (spendWeekly > 0) {
    await db.query(
      `INSERT INTO t_points_log (user_id, direction, points_type, amount, balance_after, reason, ref_type, ref_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [userId, DIRECTION_SPEND, POINTS_TYPE_WEEKLY, spendWeekly, weekly - spendWeekly, reason, refType ?? null, refId ?? null]
    )
  }
  if (spendPermanent > 0) {
    await db.query(
      `INSERT INTO t_points_log (user_id, direction, points_type, amount, balance_after, reason, ref_type, ref_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [userId, DIRECTION_SPEND, POINTS_TYPE_PERMANENT, spendPermanent, permanent - spendPermanent, reason, refType ?? null, refId ?? null]
    )
  }

  return {
    weekly: weekly - spendWeekly,
    permanent: permanent - spendPermanent,
    total: weekly + permanent - amount,
  }
}

/**
 * 发放积分（签到奖励、购买计划赠送、客服手动调整等）
 */
export async function grantPoints(
  userId: string | bigint,
  amount: number,
  pointsType: number,
  reason: string,
  refType?: string,
  refId?: string
): Promise<PointsBalance> {
  if (amount <= 0) throw createError({ statusCode: 400, message: '积分发放数量必须大于0' })

  await ensureWeeklyReset(userId)

  const db = useDb()
  const column = pointsType === POINTS_TYPE_WEEKLY ? 'points_weekly' : 'points_permanent'

  await db.query(`UPDATE t_user SET ${column} = ${column} + ? WHERE id=?`, [amount, userId])

  const [[user]]: any = await db.query(
    `SELECT points_weekly, points_permanent FROM t_user WHERE id=? AND deleted=0`,
    [userId]
  )
  const weekly = user.points_weekly ?? 0
  const permanent = user.points_permanent ?? 0
  const balanceAfter = pointsType === POINTS_TYPE_WEEKLY ? weekly : permanent

  await db.query(
    `INSERT INTO t_points_log (user_id, direction, points_type, amount, balance_after, reason, ref_type, ref_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [userId, DIRECTION_GAIN, pointsType, amount, balanceAfter, reason, refType ?? null, refId ?? null]
  )

  return { weekly, permanent, total: weekly + permanent }
}
