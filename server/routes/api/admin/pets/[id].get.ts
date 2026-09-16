// GET /api/admin/pets/[id] — 后台查看任意宠物档案详情
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    `SELECT p.id, p.user_id, u.phone, u.nickname, p.name, p.avatar, p.species, p.breed,
            p.gender, p.birthday, p.weight, p.bio, p.device_id,
            p.satiety, p.mood, p.cleanliness, p.background_id, p.model_id, p.created_at
     FROM t_pet p
     LEFT JOIN t_user u ON u.id = p.user_id
     WHERE p.id=? AND p.deleted=0 LIMIT 1`,
    [id]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  return {
    ...pet,
    id: String(pet.id),
    user_id: String(pet.user_id),
    device_id: pet.device_id ? String(pet.device_id) : null,
    background_id: pet.background_id ? String(pet.background_id) : null,
    model_id: pet.model_id ? String(pet.model_id) : null,
  }
})
