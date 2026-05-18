// DELETE /sdkapi/music/playlist/[id] — 删除歌单（同时删除内部歌曲关联）
export default defineEventHandler(async (event) => {
  const user       = await requireAuth(event)
  const playlistId = Number(getRouterParam(event, 'id'))
  if (!playlistId) throw createError({ statusCode: 400, message: '歌单ID无效' })

  const db = useDb()

  const [pRows]: any = await db.query(
    'SELECT id FROM t_music_playlist WHERE id=? AND user_id=? LIMIT 1',
    [playlistId, user.id]
  )
  if (!pRows[0]) throw createError({ statusCode: 404, message: '歌单不存在' })

  // 先删明细，再删歌单
  await db.query('DELETE FROM t_music_playlist_item WHERE playlist_id=?', [playlistId])
  await db.query('DELETE FROM t_music_playlist WHERE id=?', [playlistId])

  return { success: true }
})
