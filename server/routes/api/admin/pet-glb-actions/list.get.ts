// GET /api/admin/pet-glb-actions — GLB 动作标识库列表
// 动作是内嵌在各宠物形象 GLB 模型里的动画片段，所有形象通用同一套命名，因此这里只登记标识码，不含文件
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, code, name, enabled, created_at, updated_at FROM t_pet_glb_action WHERE deleted=0 ORDER BY created_at DESC'
  )
  return { list: rows.map((r: any) => ({ ...r, id: String(r.id) })) }
})
