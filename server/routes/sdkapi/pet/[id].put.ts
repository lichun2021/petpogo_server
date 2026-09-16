// 更新宠物档案（仅本人）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const { name, avatar, species, breed, gender, birthday, weight, bio, deviceId, backgroundId, modelId } = await readBody(event)
  if (!name) throw createError({ statusCode: 400, message: '宠物名称不能为空' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    'SELECT id FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1',
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  if (backgroundId) {
    const [[bg]]: any = await db.query('SELECT id FROM t_pet_background WHERE id=? AND deleted=0 AND enabled=1 LIMIT 1', [backgroundId])
    if (!bg) throw createError({ statusCode: 400, message: '选择的背景不存在或已停用' })
  }
  if (modelId) {
    const [[md]]: any = await db.query('SELECT id FROM t_pet_model WHERE id=? AND deleted=0 AND enabled=1 LIMIT 1', [modelId])
    if (!md) throw createError({ statusCode: 400, message: '选择的形象不存在或已停用' })
  }

  await db.query(
    `UPDATE t_pet
        SET name=?, avatar=?, species=?, breed=?, gender=?, birthday=?, weight=?, bio=?, device_id=?, background_id=?, model_id=?, updated_at=NOW()
      WHERE id=? AND user_id=?`,
    [name, avatar || null, species || null, breed || null, gender ?? 0, birthday || null, weight || null, bio || null, deviceId || null, backgroundId || null, modelId || null, id, user.userId]
  )
  return { success: true }
})
