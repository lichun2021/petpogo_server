// GET /api/admin/pet-interaction-types — 互动类型列表（喂食/逗猫/清洁等，后台可增删改查）
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT it.id, it.code, it.name, it.icon_url, ga.id AS glb_action_id, ga.code AS glb_action_code, ga.name AS glb_action_name,
            it.satiety_delta, it.mood_delta, it.cleanliness_delta, it.enabled, it.created_at, it.updated_at
       FROM t_pet_interaction_type it
       LEFT JOIN t_pet_glb_action ga ON ga.id = it.glb_action_id AND ga.deleted = 0
      WHERE it.deleted=0
      ORDER BY it.created_at ASC`
  )
  return {
    list: rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      glb_action_id: r.glb_action_id ? String(r.glb_action_id) : null,
    })),
  }
})
