// 获取宠物列表
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()
  const [list]: any = await db.query(
    'SELECT id,name,avatar,species,breed,gender,birthday,weight,bio,device_id FROM t_pet WHERE user_id=? AND deleted=0 ORDER BY created_at DESC',
    [user.userId]
  )
  return list.map((p: any) => ({ ...p, id: String(p.id), device_id: p.device_id ? String(p.device_id) : null }))
})
