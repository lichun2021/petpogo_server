
// 更新用户信息
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { avatar, gender, bio } = body
  let { nickname, birthday, email } = body
  if (nickname !== undefined) {
    if (typeof nickname !== 'string' || !nickname.trim() || Array.from(nickname.trim()).length > 30)
      throw createError({ statusCode: 400, message: '昵称需为1–30个字' })
    nickname = nickname.trim()
  }
  if (gender !== undefined && ![0, 1, 2].includes(gender))
    throw createError({ statusCode: 400, message: '请选择有效性别' })
  if (birthday === '') birthday = null
  if (birthday !== undefined && birthday !== null) {
    const date = typeof birthday === 'string' ? new Date(`${birthday}T00:00:00Z`) : new Date(NaN)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
    if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
        !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birthday ||
        birthday < '1900-01-01' || birthday > today)
      throw createError({ statusCode: 400, message: '请输入有效生日' })
  }
  if (email !== undefined && email !== null) {
    if (typeof email !== 'string') throw createError({ statusCode: 400, message: '请输入有效邮箱' })
    email = email.trim() || null
    if (email !== null && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      throw createError({ statusCode: 400, message: '请输入有效邮箱' })
  }

  const db = useDb()
  const fields: string[] = []
  const params: any[] = []
  if (nickname !== undefined) { fields.push('nickname=?'); params.push(nickname) }
  if (avatar !== undefined) { fields.push('avatar=?'); params.push(avatar) }
  if (gender !== undefined) { fields.push('gender=?'); params.push(gender) }
  if (birthday !== undefined) { fields.push('birthday=?'); params.push(birthday) }
  if (email !== undefined) { fields.push('email=?'); params.push(email) }
  if (bio !== undefined) { fields.push('bio=?'); params.push(bio) }
  if (!fields.length) throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  fields.push('updated_at=NOW()')
  params.push(user.userId)
  await db.query(`UPDATE t_user SET ${fields.join(',')} WHERE id=?`, params)

  // ── 同步到腾讯 IM（异步，不阻塞）────────────────────────────
  if (nickname !== undefined || avatar !== undefined) {
    imUpdateProfile(user.userId, {
      ...(nickname !== undefined && { nickname }),
      ...(avatar !== undefined && { avatar }),
    }).catch((e: any) => console.error('[IM] 资料同步失败:', e.message))
  }

  // ── 同步到对方后台（异步，仅同步对方支持的字段）──────────────
  // 字段映射：nickname → name（对方无 avatar/bio/birthday）
  const peerParams: { name?: string; sex?: number } = {}
  if (nickname !== undefined) peerParams.name = nickname
  if (gender !== undefined) peerParams.sex = gender  // 1=男 2=女，与对方一致

  if (Object.keys(peerParams).length > 0) {
    // 从 Authorization header 取出 ipet_token
    const authHeader = getHeader(event, 'Authorization') || getHeader(event, 'authorization')
    const granwinToken = authHeader?.replace('Bearer ', '').trim() || ''
    peerSyncProfile(granwinToken, peerParams)
      .catch((e: any) => console.error('[iPet] 用户资料同步失败:', e.message))
  }

  return { success: true }
})
