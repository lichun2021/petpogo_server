// PUT /api/admin/sound/preset/:id — 后台：编辑预设声音
// Body: emotion / name / url / sortOrder / status（部分传）

export default defineEventHandler(async (event) => {
  const id   = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'id 无效' })

  const { emotion, petType, name, url, sortOrder, status } = body ?? {}
  const fields: string[] = []
  const params: any[]    = []

  if (emotion    !== undefined) { fields.push('emotion = ?');    params.push(String(emotion).trim()) }
  if (petType    !== undefined) { fields.push('pet_type = ?');   params.push(String(petType).trim()) }
  if (name       !== undefined) { fields.push('name = ?');       params.push(String(name).trim()) }
  if (url        !== undefined) { fields.push('url = ?');        params.push(String(url).trim()) }
  if (sortOrder  !== undefined) { fields.push('sort_order = ?'); params.push(Number(sortOrder)) }
  if (status     !== undefined) { fields.push('status = ?');     params.push(Number(status)) }

  if (!fields.length) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const db = useDb()
  params.push(id)
  try {
    const [result]: any = await db.query(
      `UPDATE t_sound_preset SET ${fields.join(', ')} WHERE id = ?`, params
    )
    if (result.affectedRows === 0) throw createError({ statusCode: 404, message: '记录不存在' })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      const pt = String(petType ?? '').trim()
      const ptLabel = pt === 'dog' ? '狗狗' : '猫咪'
      throw createError({ statusCode: 409, message: `${ptLabel}已存在「${emotion}」情绪的声音，每种物种每个情绪只能有一条预设` })
    }
    throw err
  }
})
