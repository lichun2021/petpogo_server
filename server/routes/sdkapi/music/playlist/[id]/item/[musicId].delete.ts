// DELETE /sdkapi/music/playlist/[id]/item/[musicId] — 从歌单移除歌曲
export default defineEventHandler(async (event) => {
  const user       = await requireAuth(event)
  const playlistId = Number(getRouterParam(event, 'id'))
  const musicId    = Number(getRouterParam(event, 'musicId'))

  if (!playlistId || !musicId) throw createError({ statusCode: 400, message: '参数无效' })

  const db = useDb()

  // 校验归属
  const [pRows]: any = await db.query(
    'SELECT id FROM t_music_playlist WHERE id=? AND user_id=? LIMIT 1',
    [playlistId, user.userId]
  )
  if (!pRows[0]) throw createError({ statusCode: 404, message: '歌单不存在' })

  await db.query(
    'DELETE FROM t_music_playlist_item WHERE playlist_id=? AND music_id=?',
    [playlistId, musicId]
  )

  return { success: true }
})
