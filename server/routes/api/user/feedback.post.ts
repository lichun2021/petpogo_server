// POST /api/user/feedback  —— App 提交用户反馈（建议/投诉/好评）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const { type, title, content } = body ?? {}

  // 类型校验：1=建议 2=投诉 3=好评
  const validTypes = [1, 2, 3]
  if (!validTypes.includes(Number(type))) {
    throw createError({ statusCode: 400, message: '反馈类型无效（1建议/2投诉/3好评）' })
  }

  if (!content || String(content).trim().length === 0) {
    throw createError({ statusCode: 400, message: '反馈内容不能为空' })
  }
  if (String(content).trim().length > 50) {
    throw createError({ statusCode: 400, message: '反馈内容不能超过50字' })
  }

  const typeLabels: Record<number, string> = { 1: '建议', 2: '投诉', 3: '好评' }
  const finalTitle = (title && String(title).trim()) || typeLabels[Number(type)]

  const db = useDb()

  // 查询提交时的用户昵称（冗余存储，防止用户改名后历史记录失真）
  const [[dbUser]]: any = await db.query(
    'SELECT nickname FROM t_user WHERE id = ? AND deleted = 0 LIMIT 1',
    [user.userId]
  )
  const nickname = dbUser?.nickname || ''

  await db.query(
    'INSERT INTO t_feedback (user_id, nickname, type, title, content) VALUES (?, ?, ?, ?, ?)',
    [user.userId, nickname, Number(type), finalTitle, String(content).trim()]
  )

  return { success: true, message: '反馈提交成功，感谢您的意见！' }
})
