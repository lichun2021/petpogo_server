// GET /sdkapi/points/balance
// 查询当前用户积分余额（周积分 + 永久积分）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return await getPointsBalance(user.userId)
})
