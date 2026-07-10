// POST /sdkapi/checkin/makeup
// 补签（优先使用会员每周配额；配额用尽则返回错误，前端自行调用广告）
// 每周一自动重置配额（与周积分重置周期相同）
//
// 请求体：
//   date  string  YYYY-MM-DD（必填，只能补签 3 天内的缺签日期）

// 本地日期格式化（避免 toISOString UTC 时区偏移）
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { date } = await readBody(event)
  if (!date?.trim()) throw createError({ statusCode: 400, message: 'date 不能为空' })

  const dateStr = String(date).trim()
  // 解析为本地时间（避免 new Date(str) 走 UTC）
  const [ty, tm, td] = dateStr.split('-').map(Number)
  if (!ty || !tm || !td || isNaN(ty) || isNaN(tm) || isNaN(td)) {
    throw createError({ statusCode: 400, message: 'date 格式无效，应为 YYYY-MM-DD' })
  }
  const targetDate = new Date(ty, tm - 1, td) // 本地午夜

  const now = new Date()
  const today = localDateStr(now)
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // 今日本地午夜

  if (dateStr >= today) {
    throw createError({ statusCode: 400, message: '只能补签过去的日期' })
  }

  const daysSince = Math.floor((todayDate.getTime() - targetDate.getTime()) / 86400000)
  if (daysSince > 3) {
    throw createError({ statusCode: 400, message: '只能补签 3 天内的缺签日期' })
  }

  const db = useDb()

  // 检查该日期是否已签到
  const [[existing]]: any = await db.query(
    `SELECT id FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, dateStr]
  )
  if (existing) {
    throw createError({ statusCode: 400, message: '该日期已签到，无需补签' })
  }

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
  const dayOfWeek = now.getDay() // 0=周日
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

  if (usedMakeupCount >= weeklyQuota) {
    throw createError({
      statusCode: 402,
      message: `本周补签配额已用尽（${usedMakeupCount}/${weeklyQuota}），请观看广告获得额外补签机会`,
    })
  }

  // 重新计算连续签到天数（向前查找最近一次签到）
  const [[prevLog]]: any = await db.query(
    `SELECT checkin_date, streak_count FROM t_checkin_log
     WHERE user_id = ? AND checkin_date < ?
     ORDER BY checkin_date DESC LIMIT 1`,
    [user.userId, dateStr]
  )

  let streakCount = 1
  if (prevLog) {
    const prevDate = new Date(prevLog.checkin_date)
    const daysDiff = Math.floor((targetDate.getTime() - prevDate.getTime()) / 86400000)
    if (daysDiff === 1) {
      streakCount = prevLog.streak_count + 1
    }
  }

  await db.query(
    `INSERT INTO t_checkin_log (user_id, checkin_date, streak_count, is_makeup)
     VALUES (?, ?, ?, 1)`,
    [user.userId, dateStr, streakCount]
  )

  // 补签成功后，更新后续所有签到记录的 streak_count（如果后续日期连续）
  const [futureLogs]: any = await db.query(
    `SELECT checkin_date FROM t_checkin_log
     WHERE user_id = ? AND checkin_date > ?
     ORDER BY checkin_date ASC`,
    [user.userId, dateStr]
  )

  let currentDate = targetDate // 已是本地时间
  let currentStreak = streakCount
  for (const log of futureLogs) {
    const logDate = new Date(log.checkin_date)
    const diff = Math.floor((logDate.getTime() - currentDate.getTime()) / 86400000)
    if (diff === 1) {
      currentStreak++
      await db.query(
        `UPDATE t_checkin_log SET streak_count = ? WHERE user_id = ? AND checkin_date = ?`,
        [currentStreak, user.userId, log.checkin_date]
      )
      currentDate = logDate
    } else {
      break
    }
  }

  return {
    success: true,
    date: dateStr,
    streakCount,
    usedMakeupCount: usedMakeupCount + 1,
    remainingQuota: weeklyQuota - usedMakeupCount - 1,
  }
})
