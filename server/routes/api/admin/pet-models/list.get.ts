// GET /api/admin/pet-models — 形象（GLB模型）资源列表
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, name, glb_url, thumbnail_url, enabled, created_at, updated_at FROM t_pet_model WHERE deleted=0 ORDER BY created_at DESC'
  )
  return { list: rows.map((r: any) => ({ ...r, id: String(r.id) })) }
})
