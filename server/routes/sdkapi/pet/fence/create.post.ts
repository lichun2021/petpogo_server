// 创建围栏
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { deviceId, fenceName, radius, longitude, latitude, address } = await readBody(event)
  if (!deviceId || !longitude || !latitude) throw createError({ statusCode: 400, message: '缺少必要参数' })

  const db = useDb()
  const id = generateId()
  await db.query(
    `INSERT INTO t_pet_fence(id,device_id,user_id,fence_name,radius,longitude,latitude,address,created_at)
     VALUES(?,?,?,?,?,?,?,?,NOW())`,
    [id, deviceId, user.userId, fenceName || '我的围栏', radius || 500, longitude, latitude, address || '']
  )
  return { id: String(id), fenceName: fenceName || '我的围栏' }
})
