// GET /api/admin/media  —— 管理员查看所有用户图库

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page     = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 40))
  const type     = query.type ? Number(query.type) : null
  const userId   = query.userId ? String(query.userId) : ''
  const deviceId = query.deviceId ? String(query.deviceId) : ''
  const keyword  = query.keyword ? String(query.keyword).trim() : ''

  const db = useDb()

  const conditions = ['m.status = 1']
  const params: any[] = []

  if (type && [1, 2].includes(type)) {
    conditions.push('m.type = ?')
    params.push(type)
  }
  if (userId) {
    conditions.push('m.user_id = ?')
    params.push(userId)
  }
  if (deviceId) {
    conditions.push('m.device_id = ?')
    params.push(deviceId)
  }
  if (keyword) {
    conditions.push('(m.nickname LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) as total FROM t_media m
     JOIN t_user u ON m.user_id = u.id
     WHERE ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT m.id, m.type, m.url, m.thumb_url, m.oss_key,
            m.file_size, m.duration, m.created_at,
            m.user_id,
            COALESCE(NULLIF(m.nickname,''), u.nickname) AS nickname,
            u.avatar, u.phone
     FROM t_media m
     JOIN t_user u ON m.user_id = u.id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  // 统计卡片数据
  const [[stats]]: any = await db.query(
    `SELECT
       COUNT(*) as total,
       SUM(type = 1) as images,
       SUM(type = 2) as videos,
       SUM(file_size) as totalSize
     FROM t_media WHERE status = 1`
  )

  return {
    total,
    page,
    pageSize,
    list: rows,
    stats: {
      total:     Number(stats.total),
      images:    Number(stats.images),
      videos:    Number(stats.videos),
      totalSize: Number(stats.totalSize || 0),
    },
  }
})
