// GET /api/admin/posts/[id]  帖子详情 + 评论列表
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = useDb()

  const [[post]]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls, p.video_url, p.cover_url,
            p.like_count, p.comment_count, p.view_count, p.status, p.visibility, p.tag,
            p.created_at, p.raw_video_key,
            p.user_id,
            COALESCE(u.nickname, '宠友') AS nickname,
            u.avatar AS user_avatar, u.phone
     FROM t_post p LEFT JOIN t_user u ON p.user_id = u.id
     WHERE p.id = ? AND p.deleted = 0`,
    [id]
  )
  if (!post) throw createError({ statusCode: 404, message: '帖子不存在' })

  const [comments]: any = await db.query(
    `SELECT c.id, c.content, c.created_at, c.deleted,
            c.user_id,
            COALESCE(u.nickname, '宠友') AS nickname,
            u.avatar AS user_avatar
     FROM t_post_comment c LEFT JOIN t_user u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at DESC LIMIT 100`,
    [id]
  )

  return {
    ...post,
    id:         String(post.id),
    user_id:    String(post.user_id),
    media_urls: (() => {
      const v = post.media_urls
      if (Array.isArray(v)) return v
      if (typeof v !== 'string' || !v) return []
      if (v.startsWith('[')) { try { return JSON.parse(v) } catch { return [] } }
      if (v.startsWith('http')) return [v]
      return []
    })(),
    comments: comments.map((c: any) => ({
      ...c,
      id:      String(c.id),
      user_id: String(c.user_id),
    })),
  }
})
