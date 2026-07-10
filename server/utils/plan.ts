/**
 * 购买计划工具（Free / Pro / ProMax）
 * ─────────────────────────────────────────────────────────
 * t_plan 保存三档计划的价格、周期与积分额度，后台可编辑。
 * ─────────────────────────────────────────────────────────
 */

export interface PlanRow {
  id: string
  plan_type: number
  name: string
  price: number
  duration_days: number | null
  weekly_points_grant: number
  permanent_points_grant: number
  weekly_makeup_quota: number
  description: string | null
  status: number
  sort_order: number
}

export async function getPlan(planType: number): Promise<PlanRow | null> {
  const db = useDb()
  const [[plan]]: any = await db.query(
    `SELECT * FROM t_plan WHERE plan_type=? AND status=1`,
    [planType]
  )
  return plan ?? null
}

export async function getPlanById(planId: string | number): Promise<PlanRow | null> {
  const db = useDb()
  const [[plan]]: any = await db.query(
    `SELECT * FROM t_plan WHERE id=? AND status=1`,
    [planId]
  )
  return plan ?? null
}

/**
 * 为用户开通/续费计划：
 * - 设置 plan_type / plan_expire_at
 * - 立即将周积分刷新为新计划的周额度（不等到下周一）
 * - 一次性发放计划的永久积分赠送额度
 */
export async function applyPlan(
  userId: string | bigint,
  planId: string | number,
  reason = '购买计划'
): Promise<void> {
  const plan = await getPlanById(planId)
  if (!plan) throw createError({ statusCode: 404, message: '计划不存在' })

  const db = useDb()

  let expireAt: string | null = null
  if (plan.duration_days) {
    const d = new Date()
    d.setDate(d.getDate() + Number(plan.duration_days))
    expireAt = d.toISOString().slice(0, 19).replace('T', ' ')
  }

  const weekStart = new Date()
  const day = weekStart.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  weekStart.setDate(weekStart.getDate() - diffToMonday)
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  await db.query(
    `UPDATE t_user
     SET plan_type=?, plan_expire_at=?, points_weekly=?, points_week_start=?
     WHERE id=?`,
    [plan.plan_type, expireAt, plan.weekly_points_grant, weekStartStr, userId]
  )

  if (plan.permanent_points_grant > 0) {
    await grantPoints(userId, plan.permanent_points_grant, POINTS_TYPE_PERMANENT, `${reason}(${plan.name})赠送永久积分`, 'plan_order', String(planId))
  }
}
