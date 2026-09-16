// PUT /api/admin/pets/[id] — 后台编辑任意宠物档案
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, avatar, species, breed, gender, birthday, weight, bio, deviceId } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '宠物名称不能为空' })

  const db = useDb()
  const [[pet]]: any = await db.query('SELECT id FROM t_pet WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  await db.query(
    `UPDATE t_pet
        SET name=?, avatar=?, species=?, breed=?, gender=?, birthday=?, weight=?, bio=?, device_id=?, updated_at=NOW()
      WHERE id=?`,
    [name.trim(), avatar || null, species || null, breed || null, gender ?? 0, birthday || null, weight || null, bio || null, deviceId || null, id]
  )
  return { success: true }
})
