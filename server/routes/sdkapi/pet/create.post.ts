// 创建宠物档案
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { name, avatar, species, breed, gender, birthday, weight, bio, deviceId } = await readBody(event)
  if (!name) throw createError({ statusCode: 400, message: '宠物名称不能为空' })

  const db = useDb()
  const [result]: any = await db.query(
    'INSERT INTO t_pet(user_id,name,avatar,species,breed,gender,birthday,weight,bio,device_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW())',
    [user.userId, name, avatar || null, species || null, breed || null, gender ?? 0, birthday || null, weight || null, bio || null, deviceId || null]
  )
  return { id: String(result.insertId), name }
})
