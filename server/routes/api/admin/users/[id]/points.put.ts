// PUT /api/admin/users/[id]/points — 管理员手动调整用户积分
//
// 请求体：
//   pointsType  number  1周积分 2永久积分（必填）
//   amount      number  调整数量，可正可负（必填，负数为扣减）
//   reason      string  调整原因（可选，默认"管理员手动调整"）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = getRouterParam(event, 'id')
  const { pointsType, amount, reason } = await readBody(event)

  if (![POINTS_TYPE_WEEKLY, POINTS_TYPE_PERMANENT].includes(pointsType)) {
    throw createError({ statusCode: 400, message: 'pointsType 无效' })
  }
  if (!amount || Number(amount) === 0) {
    throw createError({ statusCode: 400, message: 'amount 不能为0' })
  }

  const db = useDb()
  const [[user]]: any = await db.query('SELECT id FROM t_user WHERE id=? AND deleted=0', [id])
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  const n = Number(amount)
  const finalReason = reason?.trim() || '管理员手动调整'

  let balance
  if (n > 0) {
    balance = await grantPoints(id!, n, pointsType, finalReason, 'admin_adjust')
  } else {
    balance = await spendPoints(id!, -n, finalReason, 'admin_adjust')
  }

  return { success: true, balance }
})
