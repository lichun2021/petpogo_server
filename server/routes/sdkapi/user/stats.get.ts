// 获取用户主页统计数据：发帖量、粉丝量、获赞总数
// GET /sdkapi/user/stats
// GET /sdkapi/user/stats?userId=xxx  (查看他人)
export default defineEventHandler(async (event) => {
  const authUser = await requireAuth(event)
  const query = getQuery(event)

  // 默认查自己，也可以传 userId 查看他人
  const targetUserId = (query.userId as string) || authUser.userId

  const db = useDb()

  const [[stats]]: any = await db.query(
    `SELECT
      (SELECT COUNT(*) FROM t_post   WHERE user_id = ? AND deleted = 0)                                                AS post_count,
      (SELECT COUNT(*) FROM t_follow WHERE following_id = ?)                                                            AS follower_count,
      (SELECT COUNT(*) FROM t_like   WHERE target_type = 1 AND target_id IN (SELECT id FROM t_post WHERE user_id = ? AND deleted = 0)) AS like_count
    `,
    [targetUserId, targetUserId, targetUserId]
  )

  return {
    userId:         targetUserId,
    postCount:      stats.post_count      ?? 0,
    followerCount:  stats.follower_count  ?? 0,
    likeCount:      stats.like_count      ?? 0,
  }
})
