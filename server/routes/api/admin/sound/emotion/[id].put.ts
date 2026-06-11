// PUT /api/admin/sound/emotion/:id
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'id 无效' })
  const body = await readBody(event)
  const { petType, value, label, emoji, color, activeBg, textColor, sortOrder, url, status } = body ?? {}
  const fields: string[] = []; const params: any[] = []
  if (petType    !== undefined) { fields.push('pet_type = ?');   params.push(String(petType).trim()) }
  if (value      !== undefined) { fields.push('value = ?');      params.push(String(value).trim()) }
  if (label      !== undefined) { fields.push('label = ?');      params.push(String(label).trim()) }
  if (emoji      !== undefined) { fields.push('emoji = ?');      params.push(emoji) }
  if (color      !== undefined) { fields.push('color = ?');      params.push(color) }
  if (activeBg   !== undefined) { fields.push('active_bg = ?');  params.push(activeBg) }
  if (textColor  !== undefined) { fields.push('text_color = ?'); params.push(textColor) }
  if (sortOrder  !== undefined) { fields.push('sort_order = ?'); params.push(Number(sortOrder)) }
  if (url        !== undefined) { fields.push('url = ?');        params.push(url || null) }
  if (status     !== undefined) { fields.push('status = ?');     params.push(Number(status)) }
  if (!fields.length) throw createError({ statusCode: 400, message: '无可更新字段' })
  const db = useDb()
  params.push(id)
  const [result]: any = await db.query(`UPDATE t_sound_emotion SET ${fields.join(', ')} WHERE id = ?`, params)
  if (result.affectedRows === 0) throw createError({ statusCode: 404, message: '记录不存在' })
  return { success: true }
})
