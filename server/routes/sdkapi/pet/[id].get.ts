// 获取宠物档案详情（仅本人）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    'SELECT id,name,avatar,species,breed,gender,birthday,weight,bio,device_id,satiety,mood,cleanliness,background_id,model_id,model_snapshot,model_assignment_source,model_rule_name,model_assigned_at FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1',
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  return {
    ...pet,
    model_snapshot: parsePetJson(pet.model_snapshot),
    id: String(pet.id),
    device_id: pet.device_id ? String(pet.device_id) : null,
    background_id: pet.background_id ? String(pet.background_id) : null,
    model_id: pet.model_id ? String(pet.model_id) : null,
  }
})
