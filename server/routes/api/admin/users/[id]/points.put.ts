// PUT /api/admin/users/[id]/points — 管理员手动调整用户积分
//
// 请求体：
//   typeCode    string  积分类型(引用 t_points_config.type_code，如 permanent/checkin/plan_free)（必填，发放时用）
//   pointsType  number  废弃：旧 1周积分 2永久积分（兼容保留，优先级低于 typeCode）
//   amount      number  调整数量，可正可负（必填，负数为扣减）
//   reason      string  调整原因（可选，默认"管理员手动调整"）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = getRouterParam(event, 'id')
  const { typeCode, pointsType, amount, reason } = await readBody(event)

  // 解析积分类型：优先 typeCode，兼容旧 pointsType
  let resolvedTypeCode: string | undefined = typeCode
  if (!resolvedTypeCode && pointsType) {
    resolvedTypeCode = pointsType === POINTS_TYPE_PERMANENT ? 'permanent' : 'plan_free'
  }
  if (!resolvedTypeCode) {
    throw createError({ statusCode: 400, message: 'typeCode 无效（需传入 type_code 或旧 pointsType）' })
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
    balance = await grantPointsBatch(id!, n, resolvedTypeCode, finalReason, 'admin_adjust')
  } else {
    balance = await spendPoints(id!, -n, finalReason, 'admin_adjust')
  }

  return { success: true, balance }
})
