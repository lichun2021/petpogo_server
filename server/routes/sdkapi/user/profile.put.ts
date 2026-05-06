// 更新用户信息
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { nickname, avatar, gender, birthday, bio } = await readBody(event)
  const db = useDb()
  const fields: string[] = []
  const params: any[] = []
  if (nickname !== undefined) { fields.push('nickname=?'); params.push(nickname) }
  if (avatar   !== undefined) { fields.push('avatar=?');   params.push(avatar) }
  if (gender   !== undefined) { fields.push('gender=?');   params.push(gender) }
  if (birthday !== undefined) { fields.push('birthday=?'); params.push(birthday) }
  if (bio      !== undefined) { fields.push('bio=?');      params.push(bio) }
  if (!fields.length) throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  fields.push('updated_at=NOW()')
  params.push(user.userId)
  await db.query(`UPDATE t_user SET ${fields.join(',')} WHERE id=?`, params)
  return { success: true }
})
