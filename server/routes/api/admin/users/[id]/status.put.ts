export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id')
  const { status } = await readBody(event)
  const db = useDb()
  await db.query('UPDATE t_user SET status=?, updated_at=NOW() WHERE id=?', [status, userId])
  return { success: true }
})
