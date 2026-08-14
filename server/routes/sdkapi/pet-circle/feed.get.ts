// GET /sdkapi/pet-circle/feed — App 端读取某只宠物的萌宠圈动态
// 查询参数: petId / page / pageSize

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const petId = String(query.petId ?? query.pet_id ?? '').trim()
  if (!petId) throw createError({ statusCode: 400, message: 'petId 不能为空' })

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? query.size) || 20))
  const offset = (page - 1) * pageSize

  const db = useDb()
  await ensurePetCirclePostTable(db)

  // 宠物可共享给多个用户，动态按 pet_id 查询，不限定 owner_user_id，
  // 否则共享方（非宠物主人）看不到该宠物的萌宠圈动态。
  const params = [petId]
  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total
     FROM t_pet_circle_post
     WHERE pet_id = ? AND status = 1`,
    params,
  )

  const [rows]: any = await db.query(
    `SELECT id, owner_user_id, pet_id, pet_name, pet_avatar, content, media_type,
            media_urls, cover_url, event_type, source_id, source_time, created_at
     FROM t_pet_circle_post
     WHERE pet_id = ? AND status = 1
     ORDER BY COALESCE(source_time, created_at) DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  return {
    total: Number(total),
    page,
    pageSize,
    list: rows.map(mapPetCirclePost),
  }
})
