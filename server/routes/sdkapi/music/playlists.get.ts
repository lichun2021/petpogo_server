// GET /sdkapi/music/playlists — 获取当前用户所有歌单（含每个歌单的歌曲数和封面）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db   = useDb()

  const [rows]: any = await db.query(`
    SELECT
      p.id, p.name, p.cover_url, p.created_at,
      COUNT(i.id) AS music_count
    FROM t_music_playlist p
    LEFT JOIN t_music_playlist_item i ON i.playlist_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [user.id])

  return {
    list: rows.map((r: any) => ({
      id:         Number(r.id),
      name:       r.name,
      coverUrl:   r.cover_url,
      musicCount: Number(r.music_count),
      createdAt:  r.created_at,
    }))
  }
})
