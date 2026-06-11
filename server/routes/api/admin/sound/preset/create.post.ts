// POST /api/admin/sound/preset/create — 后台：新建预设声音
// 同一物种下 emotion 唯一（cat+happy 只能有一条）

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { emotion, petType = 'cat', name, url, sortOrder = 0, status = 1 } = body ?? {}

  if (!petType?.trim()) throw createError({ statusCode: 400, message: 'petType 不能为空（cat/dog）' })
  if (!name?.trim())    throw createError({ statusCode: 400, message: 'name 不能为空' })
  if (!url?.trim())     throw createError({ statusCode: 400, message: 'url 不能为空' })

  const db = useDb()
  try {
    const [result]: any = await db.query(
      `INSERT INTO t_sound_preset (emotion, pet_type, name, url, sort_order, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [emotion ? String(emotion).trim() : null, String(petType).trim(), String(name).trim(), String(url).trim(), Number(sortOrder), Number(status)]
    )
    return { success: true, id: Number(result.insertId) }
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      const pt = petType === 'cat' ? '猫咪' : '狗狗'
      throw createError({ statusCode: 409, message: `${pt}已存在「${emotion}」情绪的声音，每种物种每个情绪只能有一条预设` })
    }
    throw err
  }
})
