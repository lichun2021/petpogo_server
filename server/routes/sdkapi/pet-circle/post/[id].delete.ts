// DELETE /sdkapi/pet-circle/post/:id — 删除自己的萌宠圈动态

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 400, message: 'id 不能为空' })

  const db = useDb()
  await ensurePetCirclePostTable(db)

  const [result]: any = await db.query(
    `UPDATE t_pet_circle_post
     SET status = 0, updated_at = NOW()
     WHERE id = ? AND owner_user_id = ? AND status = 1`,
    [id, user.userId],
  )

  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, message: '动态不存在或无权限' })
  }

  return { success: true }
})
