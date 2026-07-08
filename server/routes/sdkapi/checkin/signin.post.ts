// POST /sdkapi/checkin/signin
// 纯签到：记录今日签到并计算连续签到天数
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()

  const today = new Date().toISOString().slice(0, 10)

  const [[existing]]: any = await db.query(
    `SELECT id FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, today]
  )
  if (existing) {
    throw createError({ statusCode: 400, message: '今日已签到' })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const [[prev]]: any = await db.query(
    `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
    [user.userId, yesterdayStr]
  )
  const streakCount = prev ? prev.streak_count + 1 : 1

  await db.query(
    `INSERT INTO t_checkin_log (user_id, checkin_date, streak_count) VALUES (?, ?, ?)`,
    [user.userId, today, streakCount]
  )

  return { checkinDate: today, streakCount }
})
