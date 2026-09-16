// GET /api/admin/pet-backgrounds — 背景资源列表
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, name, image_url, enabled, created_at, updated_at FROM t_pet_background WHERE deleted=0 ORDER BY created_at DESC'
  )
  return { list: rows.map((r: any) => ({ ...r, id: String(r.id) })) }
})
