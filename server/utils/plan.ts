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
  price_monthly: number
  price_yearly: number
  duration_days: number | null
  grant_period_days: number
  period_grant_amount: number
  period_grant_type_code: string | null
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
 * - 设置 plan_type / plan_expire_at（按购买档位 monthly=30天 yearly=365天，Free 无到期）
 * - 立即累加发放本周期的积分（一批，相对周期），并置 last_grant_at=NOW()（本周期不再重复发）
 *
 * @param period  购买档位：'monthly' / 'yearly'（决定订阅周期长度；Free 忽略）
 */
export async function applyPlan(
  userId: string | bigint,
  planId: string | number,
  reason = '购买计划',
  period: 'monthly' | 'yearly' = 'monthly'
): Promise<void> {
  const plan = await getPlanById(planId)
  if (!plan) throw createError({ statusCode: 404, message: '计划不存在' })

  const db = useDb()

  // 订阅周期：付费计划按购买档位（月=30天 / 年=365天）；Free 无到期（NULL=永久）
  let expireAt: string | null = null
  if (plan.plan_type !== 0) {
    const durationDays = period === 'yearly' ? 365 : 30
    const d = new Date()
    d.setDate(d.getDate() + durationDays)
    expireAt = d.toISOString().slice(0, 19).replace('T', ' ')
  }

  // 更新计划类型与到期时间（不再覆盖积分余额，积分走批次表）
  await db.query(
    `UPDATE t_user SET plan_type=?, plan_expire_at=? WHERE id=?`,
    [plan.plan_type, expireAt, userId]
  )

  // 立即累加发放本周期积分（一批），置 last_grant_at=NOW() 避免本周期再被 cron/ensurePeriodGrant 重复发
  // 注意：积分类型由计划 period_grant_type_code 决定，配成 permanent 即发永久积分，无需单独的 permanent grant
  const periodAmount = Number(plan.period_grant_amount) || 0
  const typeCode = plan.period_grant_type_code || 'plan_free'
  if (periodAmount > 0) {
    await grantPointsBatch(userId, periodAmount, typeCode, `${reason}(${plan.name})赠送周期积分`, 'plan_order', String(planId))
    await db.query(`UPDATE t_user SET last_grant_at=NOW() WHERE id=?`, [userId])
  }
}
