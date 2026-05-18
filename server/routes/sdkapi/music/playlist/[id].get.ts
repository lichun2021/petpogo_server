// GET /sdkapi/music/playlist/[id] — 获取歌单详情（含歌曲列表）
export default defineEventHandler(async (event) => {
  const user       = await requireAuth(event)
  const playlistId = Number(getRouterParam(event, 'id'))
  if (!playlistId) throw createError({ statusCode: 400, message: '歌单ID无效' })

  const db = useDb()

  // 校验归属
  const [pRows]: any = await db.query(
    'SELECT id, name, cover_url, created_at FROM t_music_playlist WHERE id=? AND user_id=? LIMIT 1',
    [playlistId, user.userId]
  )
  if (!pRows[0]) throw createError({ statusCode: 404, message: '歌单不存在' })

  // 查询歌单内的歌曲（join music 表）
  const [musicRows]: any = await db.query(`
    SELECT m.id, m.name, m.icon_url, m.music_url, m.duration, c.name AS category_name, i.sort_order
    FROM t_music_playlist_item i
    JOIN t_music m ON m.id = i.music_id
    LEFT JOIN t_music_category c ON c.id = m.category_id
    WHERE i.playlist_id = ? AND m.status = 1
    ORDER BY i.sort_order ASC, i.id ASC
  `, [playlistId])

  const playlist = pRows[0]
  return {
    id:           Number(playlist.id),
    name:         playlist.name,
    coverUrl:     playlist.cover_url,
    createdAt:    playlist.created_at,
    music: musicRows.map((m: any) => ({
      id:           Number(m.id),
      name:         m.name,
      iconUrl:      m.icon_url,
      musicUrl:     m.music_url,
      duration:     m.duration,
      categoryName: m.category_name,
    })),
  }
})
