// GET /api/admin/posts?page=1&size=12&status=2&mediaType=1
export default defineEventHandler(async (event) => {
  const { page = 1, size = 12, status = '', mediaType = '' } = getQuery(event)
  const db     = useDb()
  const offset = (Number(page) - 1) * Number(size)

  const conditions: string[] = ['p.deleted = 0']
  const params: any[]        = []

  if (status !== '') {
    conditions.push('p.status = ?')
    params.push(Number(status))
  }
  if (mediaType !== '') {
    conditions.push('p.media_type = ?')
    params.push(Number(mediaType))
  }

  const where = conditions.join(' AND ')

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_post p WHERE ${where}`, params
  )
  const [list]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls, p.video_url, p.cover_url,
            p.like_count, p.comment_count, p.status, p.created_at,
            p.user_id,
            COALESCE(u.nickname, '宠友') AS nickname,
            u.avatar AS user_avatar
     FROM t_post p LEFT JOIN t_user u ON p.user_id = u.id
     WHERE ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  // 待审核数量
  const [[{ pendingCount }]]: any = await db.query(
    'SELECT COUNT(*) AS pendingCount FROM t_post WHERE status=2 AND deleted=0'
  )

  return {
    list: list.map((p: any) => ({
      ...p,
      id:         String(p.id),
      user_id:    String(p.user_id),
      media_urls: Array.isArray(p.media_urls)
        ? p.media_urls
        : (typeof p.media_urls === 'string' ? JSON.parse(p.media_urls) : []),
    })),
    total:        Number(total),
    pendingCount: Number(pendingCount),
    page:         Number(page),
    size:         Number(size),
  }
})
