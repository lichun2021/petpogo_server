// PUT /api/admin/users/[id]/vip
// 管理员设置/取消用户 VIP
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { vip, days } = await readBody(event)
  // vip: true=开通 false=取消
  // days: VIP 天数，null=永久

  const db = useDb()

  if (!vip) {
    // 取消 VIP
    await db.query(
      `UPDATE t_user SET vip_status=0, vip_expire_at=NULL, ai_daily_limit=10
       WHERE id=?`,
      [id]
    )
    return { message: '已取消 VIP' }
  }

  // 开通 VIP
  let expireAt = null
  if (days && Number(days) > 0) {
    const d = new Date()
    d.setDate(d.getDate() + Number(days))
    expireAt = d.toISOString().slice(0, 19).replace('T', ' ')
  }

  await db.query(
    `UPDATE t_user SET vip_status=1, vip_expire_at=?, ai_daily_limit=-1
     WHERE id=?`,
    [expireAt, id]
  )

  return {
    message: expireAt ? `VIP 已开通，到期：${expireAt}` : 'VIP 已开通（永久）',
    vip_expire_at: expireAt,
  }
})
