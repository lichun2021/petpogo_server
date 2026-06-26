// GET /sdkapi/share/resolve — App 端解析分享码
// query: code

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const code = normalizeShareCode(getQuery(event).code)
  const db = useDb()
  await ensureShareLinkTable(db)

  const [[row]]: any = await db.query(
    `SELECT code, user_id, share_type, target_id, title, description, image_url, payload, expire_at, created_at
     FROM t_share_link
     WHERE code=? AND status=1 AND expire_at > NOW()
     LIMIT 1`,
    [code],
  )

  if (!row) throw createError({ statusCode: 404, message: '分享不存在或已过期' })

  return {
    ...toPublicShare(row),
    targetId: String(row.target_id),
    createdByCurrentUser: String(row.user_id) === String(user.userId),
  }
})
