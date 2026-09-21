// PUT /api/admin/pets/[id] — 后台编辑任意宠物档案
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, avatar, species, breed, gender, birthday, weight, bio, deviceId, assignmentMode = 'keep', modelId } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '宠物名称不能为空' })

  if (!['keep', 'rematch', 'manual'].includes(assignmentMode)) throw createError({ statusCode: 400, message: '形象分配方式无效' })
  const db = await useDb().getConnection()
  try {
    await db.beginTransaction()
    const [[pet]]: any = await db.query('SELECT id FROM t_pet WHERE id=? AND deleted=0 LIMIT 1 FOR UPDATE', [id])
    if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

    await db.query(
      `UPDATE t_pet
          SET name=?, avatar=?, species=?, breed=?, gender=?, birthday=?, weight=?, bio=?, device_id=?, updated_at=NOW()
        WHERE id=?`,
      [name.trim(), avatar || null, species || null, breed || null, gender ?? 0, birthday || null, weight || null, bio || null, deviceId || null, id]
    )
    if (assignmentMode === 'rematch') {
      await savePetModelSnapshot(db, String(id), await selectPetModel(db, { species, breed, gender }))
    } else if (assignmentMode === 'manual') {
      if (typeof modelId !== 'string' || !/^[1-9]\d{0,18}$/.test(modelId)) throw createError({ statusCode: 400, message: '请选择形象' })
      const [[model]]: any = await db.query('SELECT * FROM t_pet_model WHERE id=? AND enabled=1 AND deleted=0 FOR UPDATE', [modelId])
      if (!model) throw createError({ statusCode: 400, message: '形象不存在或已停用' })
      await savePetModelSnapshot(db, String(id), { model: { id: String(model.id), name: model.name, glb_url: model.glb_url, thumbnail_url: model.thumbnail_url }, source: 'manual', ruleName: null })
    }
    await db.commit()
    return { success: true }
  } catch (e) { await db.rollback(); throw e } finally { db.release() }
})
