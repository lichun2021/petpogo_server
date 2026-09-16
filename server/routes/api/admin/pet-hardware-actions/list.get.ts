// GET /api/admin/pet-hardware-actions — 硬件动作码列表（预置5类不限量，可自定义新增）
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT h.id, h.code, h.name, h.icon_url, h.glb_action_id, ga.code AS glb_action_code, ga.name AS glb_action_name, h.enabled, h.created_at, h.updated_at
       FROM t_pet_hardware_action_type h
       LEFT JOIN t_pet_glb_action ga ON ga.id = h.glb_action_id AND ga.deleted = 0
      WHERE h.deleted=0
      ORDER BY h.created_at ASC`
  )
  return {
    list: rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      glb_action_id: r.glb_action_id ? String(r.glb_action_id) : null,
    })),
  }
})
