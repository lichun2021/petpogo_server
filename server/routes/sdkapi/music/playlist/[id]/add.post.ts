// POST /sdkapi/music/playlist/[id]/add — 向歌单添加歌曲
export default defineEventHandler(async (event) => {
  const user       = await requireAuth(event)
  const playlistId = Number(getRouterParam(event, 'id'))
  if (!playlistId) throw createError({ statusCode: 400, message: '歌单ID无效' })

  const { music_id } = await readBody(event)
  if (!music_id) throw createError({ statusCode: 400, message: '缺少 music_id' })

  const db = useDb()

  // 校验歌单归属
  const [pRows]: any = await db.query(
    'SELECT id FROM t_music_playlist WHERE id=? AND user_id=? LIMIT 1',
    [playlistId, user.id]
  )
  if (!pRows[0]) throw createError({ statusCode: 404, message: '歌单不存在' })

  // 校验歌曲存在
  const [mRows]: any = await db.query(
    'SELECT id FROM t_music WHERE id=? AND status=1 LIMIT 1',
    [music_id]
  )
  if (!mRows[0]) throw createError({ statusCode: 404, message: '音乐不存在或已下架' })

  // 忽略重复（IGNORE）
  await db.query(
    'INSERT IGNORE INTO t_music_playlist_item (playlist_id, music_id) VALUES (?, ?)',
    [playlistId, music_id]
  )

  return { success: true }
})
