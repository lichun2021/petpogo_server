
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

  // ── 同步到腾讯 IM（异步，不阻塞）────────────────────────────
  if (nickname !== undefined || avatar !== undefined) {
    imUpdateProfile(user.userId, {
      ...(nickname !== undefined && { nickname }),
      ...(avatar   !== undefined && { avatar }),
    }).catch((e: any) => console.error('[IM] 资料同步失败:', e.message))
  }

  // ── 同步到对方后台（异步，仅同步对方支持的字段）──────────────
  // 字段映射：nickname → name（对方无 avatar/bio/birthday）
  const peerParams: { name?: string; sex?: number } = {}
  if (nickname !== undefined) peerParams.name = nickname
  if (gender   !== undefined) peerParams.sex  = gender  // 1=男 2=女，与对方一致

  if (Object.keys(peerParams).length > 0) {
    // 从 Authorization header 取出 granwin_token
    const authHeader = getHeader(event, 'Authorization') || getHeader(event, 'authorization')
    const granwinToken = authHeader?.replace('Bearer ', '').trim() || ''
    peerSyncProfile(granwinToken, peerParams)
      .catch((e: any) => console.error('[iPet] 用户资料同步失败:', e.message))
  }

  return { success: true }
})
