// POST /sdkapi/music/playlists — 创建歌单
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { name, cover_url = '' } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: '歌单名称不能为空' })

  const db = useDb()
  const [result]: any = await db.query(
    'INSERT INTO t_music_playlist (user_id, name, cover_url) VALUES (?, ?, ?)',
    [user.id, name.trim(), cover_url]
  )
  return { id: Number(result.insertId), success: true }
})
