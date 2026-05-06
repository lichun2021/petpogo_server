// Admin 仪表盘数据
export default defineEventHandler(async (event) => {
  const db = useDb()
  const redis = useRedis()

  const [[users], [devices], [posts], [stores]] = await Promise.all([
    db.query('SELECT COUNT(*) as total FROM t_user WHERE deleted=0'),
    db.query('SELECT COUNT(*) as total, SUM(online_status) as online FROM t_device WHERE deleted=0'),
    db.query('SELECT COUNT(*) as total FROM t_post WHERE deleted=0 AND DATE(created_at)=CURDATE()'),
    db.query('SELECT COUNT(*) as total FROM t_store WHERE status=1'),
  ]) as any[]

  const [recentDevices]: any = await db.query(
    'SELECT mac, name, online_status, last_online_at FROM t_device WHERE deleted=0 ORDER BY last_online_at DESC LIMIT 8'
  )
  const [recentPosts]: any = await db.query(
    `SELECT p.id, p.content, p.status, u.nickname, u.avatar
     FROM t_post p JOIN t_user u ON p.user_id=u.id
     WHERE p.deleted=0 ORDER BY p.created_at DESC LIMIT 6`
  )

  return {
    totalUsers:    String(users[0]?.total || 0),
    onlineDevices: Number(devices[0]?.online || 0),
    todayPosts:    String(posts[0]?.total || 0),
    totalStores:   String(stores[0]?.total || 0),
    recentDevices,
    recentPosts,
  }
})
