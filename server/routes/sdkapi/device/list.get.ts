// 获取用户绑定的设备列表
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()
  const [list]: any = await db.query(
    `SELECT d.id, d.mac, d.name, d.online_status, d.last_online_at,
            d.longitude, d.latitude, d.address,
            ud.u_type, ud.nickname as bind_name
     FROM t_user_device ud
     JOIN t_device d ON ud.device_id = d.id
     WHERE ud.user_id=? AND d.deleted=0
     ORDER BY ud.created_at DESC`,
    [user.userId]
  )
  return list.map((d: any) => ({ ...d, id: String(d.id) }))
})
