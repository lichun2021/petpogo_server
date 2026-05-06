// 创建围栏
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { deviceId, fenceName, radius, longitude, latitude, address } = await readBody(event)
  if (!deviceId || !longitude || !latitude) throw createError({ statusCode: 400, message: '缺少必要参数' })

  const db = useDb()
  const [result]: any = await db.query(
    `INSERT INTO t_pet_fence(device_id,user_id,fence_name,radius,longitude,latitude,address,created_at)
     VALUES(?,?,?,?,?,?,?,NOW())`,
    [deviceId, user.userId, fenceName || '我的围栏', radius || 500, longitude, latitude, address || '']
  )
  return { id: String(result.insertId), fenceName: fenceName || '我的围栏' }
})
