// POST /sdkapi/sound/user/save — App：保存用户上传的声音
// Body: name / url / emotion（可选）/ duration（可选）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { name, url, emotion, duration } = body ?? {}

  if (!name?.trim()) throw createError({ statusCode: 400, message: 'name 不能为空' })
  if (!url?.trim())  throw createError({ statusCode: 400, message: 'url 不能为空' })

  const db = useDb()
  const [result]: any = await db.query(
    `INSERT INTO t_sound_user (user_id, emotion, name, url, duration) VALUES (?, ?, ?, ?, ?)`,
    [
      user.userId,
      emotion ? String(emotion).trim() : null,
      String(name).trim(),
      String(url).trim(),
      duration ? Number(duration) : null,
    ]
  )

  return { success: true, id: Number(result.insertId) }
})
