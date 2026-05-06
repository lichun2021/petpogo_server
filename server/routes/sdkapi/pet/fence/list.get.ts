// 获取设备围栏列表
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { deviceId } = getQuery(event)
  const db = useDb()
  const [list]: any = await db.query(
    `SELECT id, device_id, fence_name, radius, longitude, latitude, address
     FROM t_pet_fence WHERE user_id=? AND deleted=0 ${deviceId ? 'AND device_id=?' : ''} ORDER BY created_at DESC`,
    deviceId ? [user.userId, deviceId] : [user.userId]
  )
  return list.map((f: any) => ({ ...f, id: String(f.id), device_id: String(f.device_id) }))
})
