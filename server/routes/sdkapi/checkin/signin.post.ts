// POST /sdkapi/checkin/signin
// 纯签到：记录今日签到并计算连续签到天数
// 重复签到返回 { alreadySigned: true } 而非报错，前端直接提示"已签到"

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return withTransaction(async db => {
    await lockPointsUser(db,user.userId)

    const now = new Date()
    const today = businessDate(now)

    const [[existing]]: any = await db.query(
      `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
      [user.userId, today]
    )
    if (existing) {
      // 今日已签到：正常返回，让前端展示"已签到"提示，而非弹出错误
      return {
        alreadySigned: true,
        checkinDate:   today,
        streakCount:   existing.streak_count,
      }
    }

    const yesterdayStr = addBusinessDays(today,-1)

    const [[prev]]: any = await db.query(
      `SELECT streak_count FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
      [user.userId, yesterdayStr]
    )
    const streakCount = prev ? prev.streak_count + 1 : 1

    await db.query(
      `INSERT INTO t_checkin_log (user_id, checkin_date, streak_count) VALUES (?, ?, ?)`,
      [user.userId, today, streakCount]
    )

    return { alreadySigned: false, checkinDate: today, streakCount }
  })
})
