// PUT /api/admin/posts/:id/tag
// body: { tag: 'cat' | 'dog' | 'other' }
export default defineEventHandler(async (event) => {
  const postId = getRouterParam(event, 'id')
  const { tag } = await readBody(event)

  const VALID_TAGS = ['cat', 'dog', 'other']
  if (!VALID_TAGS.includes(tag)) {
    throw createError({ statusCode: 400, message: '无效的标签值，仅支持 cat / dog / other' })
  }

  const db = useDb()
  await db.query('UPDATE t_post SET tag=? WHERE id=?', [tag, postId])

  return { success: true }
})
