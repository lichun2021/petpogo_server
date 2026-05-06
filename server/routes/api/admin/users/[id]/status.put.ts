// PUT /api/admin/users/[id]/status
export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')
  const { status } = await readBody(event)
  if (![1, 2].includes(Number(status))) {
    throw createError({ statusCode: 400, message: '无效状态值' })
  }
  const db = useDb()
  await db.query('UPDATE t_user SET status=? WHERE id=? AND deleted=0', [status, id])
  return { success: true }
})
