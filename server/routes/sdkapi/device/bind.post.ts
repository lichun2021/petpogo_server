// 绑定设备到用户
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { mac, nickname } = await readBody(event)
  if (!mac) throw createError({ statusCode: 400, message: '缺少mac地址' })

  const db = useDb()
  // 查找或创建设备记录
  const [[device]]: any = await db.query('SELECT id FROM t_device WHERE mac=? AND deleted=0', [mac])
  if (!device) throw createError({ statusCode: 404, message: '设备不存在，请检查MAC地址' })

  // 检查是否已绑定
  const [[exist]]: any = await db.query(
    'SELECT id FROM t_user_device WHERE user_id=? AND device_id=?',
    [user.userId, device.id]
  )
  if (exist) throw createError({ statusCode: 409, message: '设备已绑定' })

  await db.query(
    'INSERT INTO t_user_device(user_id,device_id,mac,nickname,u_type,created_at) VALUES(?,?,?,?,?,NOW())',
    [user.userId, device.id, mac, nickname || mac, 'owner']
  )
  return { success: true, deviceId: String(device.id) }
})
