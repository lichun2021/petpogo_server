export default defineEventHandler(async (event) => {
  const { page = 1, size = 12, status = '', mediaType = '' } = getQuery(event)
  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)

  let where = 'WHERE p.deleted=0'
  const params: any[] = []
  if (status) { where += ' AND p.status=?'; params.push(Number(status)) }
  if (mediaType) { where += ' AND p.media_type=?'; params.push(Number(mediaType)) }

  const [[{ total }]]: any = await db.query(`SELECT COUNT(*) as total FROM t_post p ${where}`, params)
  const [[{ pending }]]: any = await db.query('SELECT COUNT(*) as pending FROM t_post WHERE status=2 AND deleted=0')
  const [list]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls, p.video_url, p.cover_url,
            p.status, p.created_at, u.nickname, u.avatar as user_avatar
     FROM t_post p JOIN t_user u ON p.user_id=u.id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return {
    list: list.map((p: any) => ({
      ...p,
      id: String(p.id),
      media_urls: p.media_urls ? JSON.parse(p.media_urls) : [],
    })),
    total: Number(total),
    pendingCount: Number(pending),
  }
})
