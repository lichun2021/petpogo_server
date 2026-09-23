// POST /sdkapi/checkin/claim
// 领取签到奖励（每日签到奖励 或 连续签到奖励）
//
// 请求体：
//   ruleId  string  t_checkin_rule.id（必填）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { ruleId } = await readBody(event)
  if (!ruleId) throw createError({ statusCode: 400, message: 'ruleId 不能为空' })

  return withTransaction(async db => {
    await lockPointsUser(db,user.userId)

    const [[rule]]: any = await db.query(
      `SELECT id, rule_type, streak_days, points_amount, points_type_code, name
       FROM t_checkin_rule WHERE id = ? AND status = 1`,
      [ruleId]
    )
    if (!rule) throw createError({ statusCode: 404, message: '奖励规则不存在' })

    const today = businessDate()

    const [[todayRow]]: any = await db.query(
      `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
      [user.userId, today]
    )
    if (!todayRow) {
      throw createError({ statusCode: 400, message: '请先完成今日签到再领取奖励' })
    }
    const currentStreak = todayRow.streak_count

    if (rule.rule_type === 2 && currentStreak < rule.streak_days) {
      throw createError({ statusCode: 400, message: `连续签到天数不足，还需 ${rule.streak_days - currentStreak} 天` })
    }

    let periodKey = today
    if (rule.rule_type === 2) {
      periodKey = addBusinessDays(today, -(currentStreak - 1))
    }

    const [[claimed]]: any = await db.query(
      `SELECT id FROM t_checkin_claim_log WHERE user_id = ? AND rule_id = ? AND period_key = ?`,
      [user.userId, ruleId, periodKey]
    )
    if (claimed) throw createError({ statusCode: 400, message: '该奖励已领取' })

    await db.query(
      `INSERT INTO t_checkin_claim_log (user_id, rule_id, period_key) VALUES (?, ?, ?)`,
      [user.userId, ruleId, periodKey]
    )

    const balance = await grantPointsBatchTx(db,user.userId, rule.points_amount, rule.points_type_code || 'checkin', rule.name, 'checkin', String(ruleId))

    return { success: true, pointsAmount: rule.points_amount, pointsTypeCode: rule.points_type_code || 'checkin', balance }
  })
})
