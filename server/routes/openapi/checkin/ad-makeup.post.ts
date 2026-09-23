// POST /openapi/checkin/ad-makeup
// 广告服务回调：用户观看完广告，直接执行补签（绕过会员配额检查）
//
// Headers: x-api-key / x-timestamp / x-signature（OpenAPI 鉴权）
//
// Body:
//   phone  string  用户手机号（必填）
//   date   string  YYYY-MM-DD（必填，补签日期）
//   refId  string  可选，广告任务ID，用于追溯
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { phone, date, refId } = body ?? {}

  if (!phone?.trim()) throw createError({ statusCode: 400, message: 'phone 不能为空' })
  if (!date?.trim()) throw createError({ statusCode: 400, message: 'date 不能为空' })

  const dateStr = parseBusinessDate(date)
  const targetDate = new Date(dateStr)
  const today = businessDate()
  if (dateStr >= today) {
    throw createError({ statusCode: 400, message: '只能补签过去的日期' })
  }

  const pool = useDb()

  const [[user]]: any = await pool.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1',
    [String(phone).trim()]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在（phone 无效）' })

  const userId = String(user.id)
  return withTransaction(async db => {
    await lockPointsUser(db,userId)

    // 检查该日期是否已签到
    const [[existing]]: any = await db.query(
      `SELECT id FROM t_checkin_log WHERE user_id = ? AND checkin_date = ?`,
      [userId, dateStr]
    )
    if (existing) {
      // 已签到，幂等返回成功（广告服务可能重试）
      return { success: true, message: '该日期已签到' }
    }

    // 重新计算连续签到天数
    const [[prevLog]]: any = await db.query(
      `SELECT checkin_date, streak_count FROM t_checkin_log
       WHERE user_id = ? AND checkin_date < ?
       ORDER BY checkin_date DESC LIMIT 1`,
      [userId, dateStr]
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
      [userId, dateStr, streakCount]
    )

    // 更新后续连续签到记录的 streak_count
    const [futureLogs]: any = await db.query(
      `SELECT checkin_date FROM t_checkin_log
       WHERE user_id = ? AND checkin_date > ?
       ORDER BY checkin_date ASC`,
      [userId, dateStr]
    )

    let currentDate = new Date(dateStr)
    let currentStreak = streakCount
    for (const log of futureLogs) {
      const logDate = new Date(log.checkin_date)
      const diff = Math.floor((logDate.getTime() - currentDate.getTime()) / 86400000)
      if (diff === 1) {
        currentStreak++
        await db.query(
          `UPDATE t_checkin_log SET streak_count = ? WHERE user_id = ? AND checkin_date = ?`,
          [currentStreak, userId, log.checkin_date]
        )
        currentDate = logDate
      } else {
        break
      }
    }


    return { success: true, date: dateStr, streakCount }
  })
})
