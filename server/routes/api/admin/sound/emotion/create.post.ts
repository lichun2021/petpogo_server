// POST /api/admin/sound/emotion/create
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { petType = 'cat', value, label, emoji = '🎵', color = '#f59e0b', activeBg = '#fef3c7', textColor = '#92400e', sortOrder = 0 } = body ?? {}
  if (!petType?.trim()) throw createError({ statusCode: 400, message: 'petType 不能为空（cat/dog）' })
  if (!value?.trim())   throw createError({ statusCode: 400, message: 'value 不能为空' })
  if (!label?.trim())   throw createError({ statusCode: 400, message: 'label 不能为空' })
  const db = useDb()
  const [result]: any = await db.query(
    `INSERT INTO t_sound_emotion (pet_type, value, label, emoji, color, active_bg, text_color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [String(petType).trim(), String(value).trim(), String(label).trim(), emoji, color, activeBg, textColor, Number(sortOrder)]
  )
  return { success: true, id: Number(result.insertId) }
})
