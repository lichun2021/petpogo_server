// GET /sdkapi/checkin/status
// 查询今日签到状态、当前连续天数，以及各签到奖励档位的领取状态
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()

  const today = businessDate()
  const yesterdayStr = addBusinessDays(today,-1)

  const [[todayRow]]: any = await db.query(
    `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, today]
  )
  const [[yesterdayRow]]: any = await db.query(
    `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, yesterdayStr]
  )

  const signedInToday = !!todayRow
  const currentStreak = todayRow ? todayRow.streak_count : (yesterdayRow ? yesterdayRow.streak_count : 0)

  // 本次连续签到的起始日期（用于连续奖励的领取记录 period_key）
  const streakStartStr = addBusinessDays(signedInToday ? today : yesterdayStr, -(Math.max(currentStreak,1)-1))

  const [rules]: any = await db.query(
    `SELECT id, rule_type, streak_days, points_amount, points_type_code, name
     FROM t_checkin_rule WHERE status = 1 ORDER BY sort_order ASC`
  )

  const [claims]: any = await db.query(
    `SELECT rule_id, period_key FROM t_checkin_claim_log WHERE user_id = ?`,
    [user.userId]
  )
  const claimedSet = new Set(claims.map((c: any) => `${c.rule_id}:${c.period_key}`))

  const list = rules.map((r: any) => {
    const periodKey = r.rule_type === 1 ? today : streakStartStr
    const claimed = claimedSet.has(`${r.id}:${periodKey}`)
    const eligible = r.rule_type === 1
      ? signedInToday
      : (signedInToday && currentStreak >= r.streak_days)

    return {
      id: String(r.id),
      ruleType: r.rule_type,
      streakDays: r.streak_days,
      pointsAmount: r.points_amount,
      pointsTypeCode: r.points_type_code,
      name: r.name,
      claimed,
      claimable: eligible && !claimed,
    }
  })

  return {
    today,
    signedInToday,
    currentStreak,
    rules: list,
  }
})
