// DELETE /api/admin/media/:id  —— 管理员软删除图库文件

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '参数错误' })

  const db = useDb()
  const [[media]]: any = await db.query(
    'SELECT id, oss_key FROM t_media WHERE id = ? AND status = 1 LIMIT 1',
    [id]
  )
  if (!media) throw createError({ statusCode: 404, message: '文件不存在' })

  await db.query('UPDATE t_media SET status = 2 WHERE id = ?', [id])

  // TODO: 后续可在此处调用 OSS SDK 删除 media.oss_key 对应的源文件
  // const ossClient = createOssClient()
  // await ossClient.delete(media.oss_key)

  return { success: true, ossKey: media.oss_key }
})
