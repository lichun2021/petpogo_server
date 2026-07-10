// GET /sdkapi/checkin/calendar
// 查询当月签到日历（每天状态：已签到/可签到/不可签到/可补签）
// + 连续签到奖励档位的可点击状态
//
// Query 参数：
//   month?  string  YYYY-MM（默认当月，如 2026-07）

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const now = new Date()
  const monthParam = query.month ? String(query.month) : localDateStr(now).slice(0, 7)
  const [year, month] = monthParam.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    throw createError({ statusCode: 400, message: 'month 格式无效，应为 YYYY-MM' })
  }

  const db = useDb()

  // 该月起止日期（本地时间格式化，不走 toISOString）
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  // 查询该月所有签到记录
  const [logs]: any = await db.query(
    `SELECT checkin_date, streak_count, is_makeup FROM t_checkin_log
     WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ?`,
    [user.userId, monthStart, monthEnd]
  )
  const logMap = new Map(logs.map((r: any) => {
    // mysql2 DATE 列可能返回 Date 对象，统一转成本地 YYYY-MM-DD 字符串
    const key = r.checkin_date instanceof Date
      ? localDateStr(r.checkin_date)
      : String(r.checkin_date).slice(0, 10)
    return [key, { streak: r.streak_count, isMarkup: r.is_makeup }]
  }))

  // 今日（本地时间）
  const today = localDateStr(now)
  const todayDate = new Date(year, now.getMonth(), now.getDate()) // 本地午夜，用于日期大小比较

  // 查询用户当前计划的每周补签配额
  const [[userRow]]: any = await db.query(
    `SELECT u.plan_type FROM t_user u WHERE u.id = ? AND u.deleted = 0`,
    [user.userId]
  )
  const planType = userRow?.plan_type ?? 0
  const [[planRow]]: any = await db.query(
    `SELECT weekly_makeup_quota FROM t_plan WHERE plan_type = ? AND status = 1`,
    [planType]
  )
  const weeklyQuota = planRow?.weekly_makeup_quota ?? 1

  // 本周已使用的补签次数（周一为起点，与周积分重置周期相同）
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
  const weekStart = localDateStr(weekMonday)

  const [[usedCount]]: any = await db.query(
    `SELECT COUNT(*) AS cnt FROM t_checkin_log
     WHERE user_id = ? AND is_makeup = 1
       AND checkin_date >= ?`,
    [user.userId, weekStart]
  )
  const usedMakeupCount = usedCount?.cnt ?? 0
  const remainingQuota = Math.max(0, weeklyQuota - usedMakeupCount)

  // 构造日历（1-daysInMonth），全部用本地时间格式化
  const calendar = []
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const dateStr = localDateStr(d)
    const log = logMap.get(dateStr)

    let status: string
    if (log) {
      status = 'signed' // 已签到（含正常签到和补签）
    } else if (dateStr === today) {
      status = 'signable' // 今日未签，可签到
    } else if (d > todayDate) {
      status = 'future' // 未来日期，不可操作
    } else {
      // 过去日期未签到：3天内且有配额才可补签
      const daysSinceToday = Math.floor((todayDate.getTime() - d.getTime()) / 86400000)
      if (daysSinceToday <= 3 && remainingQuota > 0) {
        status = 'makeup_available'
      } else {
        status = 'missed'
      }
    }

    calendar.push({
      date: dateStr,
      day,
      status,
      streakCount: log?.streak ?? null,
      isMakeup: log?.isMarkup ? true : false,
    })
  }

  // 查询连续签到奖励档位及其可点击状态
  const [[todayLog]]: any = await db.query(
    `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, today]
  )
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const yesterdayStr = localDateStr(yesterday)
  const [[yesterdayLog]]: any = await db.query(
    `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, yesterdayStr]
  )
  const signedInToday = !!todayLog
  const currentStreak = todayLog?.streak_count ?? yesterdayLog?.streak_count ?? 0

  const streakBaseDate = signedInToday ? now : yesterday
  const streakStart = new Date(streakBaseDate.getFullYear(), streakBaseDate.getMonth(), streakBaseDate.getDate() - (Math.max(currentStreak, 1) - 1))
  const streakStartStr = localDateStr(streakStart)

  const [rules]: any = await db.query(
    `SELECT id, rule_type, streak_days, points_amount, points_type, name
     FROM t_checkin_rule WHERE status = 1 ORDER BY sort_order ASC`
  )
  const [claims]: any = await db.query(
    `SELECT rule_id, period_key FROM t_checkin_claim_log WHERE user_id = ?`,
    [user.userId]
  )
  const claimedSet = new Set(claims.map((c: any) => `${c.rule_id}:${c.period_key}`))

  const rewardButtons = rules.map((r: any) => {
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
      pointsType: r.points_type,
      name: r.name,
      claimed,
      claimable: eligible && !claimed,
    }
  })

  return {
    month: monthParam,
    calendar,
    currentStreak,
    signedInToday,
    weeklyMakeupQuota: weeklyQuota,
    usedMakeupCount,
    remainingMakeupQuota: remainingQuota,
    rewardButtons,
  }
})
