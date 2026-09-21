// 获取宠物当前状态：基本信息 + 养成属性（饱腹度/心情值/清洁度，惰性衰减计算，不落库）+ 当前背景/形象资源
// App 端渲染宠物主页一次调用即可拿全，无需再拼 detail + resources
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    `SELECT p.id, p.name, p.avatar, p.species, p.breed, p.gender, p.birthday, p.weight, p.bio,
            p.satiety, p.mood, p.cleanliness, p.stats_updated_at, p.model_snapshot, p.model_assignment_source, p.model_rule_name, p.model_assigned_at,
            bg.id AS bg_id, bg.name AS bg_name, bg.image_url AS bg_image_url,
            md.id AS model_id, md.name AS model_name, md.glb_url AS model_glb_url, md.thumbnail_url AS model_thumbnail_url
       FROM t_pet p
       LEFT JOIN t_pet_background bg ON bg.id = p.background_id AND bg.deleted = 0
       LEFT JOIN t_pet_model md ON md.id = p.model_id AND md.deleted = 0
      WHERE p.id = ? AND p.user_id = ? AND p.deleted = 0 LIMIT 1`,
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  const stats = computeDecayedStats(
    { satiety: pet.satiety, mood: pet.mood, cleanliness: pet.cleanliness },
    pet.stats_updated_at
  )

  return {
    id: String(pet.id),
    name: pet.name,
    avatar: pet.avatar,
    species: pet.species,
    breed: pet.breed,
    gender: pet.gender,
    birthday: pet.birthday,
    weight: pet.weight,
    bio: pet.bio,
    ...stats,
    background: pet.bg_id
      ? { id: String(pet.bg_id), name: pet.bg_name, image_url: pet.bg_image_url }
      : null,
    model_assignment_source: pet.model_assignment_source,
    model_rule_name: pet.model_rule_name,
    model_assigned_at: pet.model_assigned_at,
    model: pet.model_snapshot ? parsePetJson(pet.model_snapshot) : pet.model_id
      ? { id: String(pet.model_id), name: pet.model_name, glb_url: pet.model_glb_url, thumbnail_url: pet.model_thumbnail_url }
      : null,
  }
})
