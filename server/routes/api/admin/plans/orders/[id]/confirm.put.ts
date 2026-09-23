export default defineEventHandler(async (event) => {
    requireSuperAdmin(event);
    const id = getRouterParam(event, 'id');
    if (!id || !/^[1-9]\d{0,18}$/.test(id))
        throw createError({ statusCode: 400, message: '订单 ID 无效' });
    const [[owner]]: any = await useDb().query('SELECT user_id FROM t_plan_order WHERE id=?', [id]);
    if (!owner)
        throw createError({ statusCode: 404, message: '订单不存在' });
    return withTransaction(async (db) => {
        await lockPointsUser(db, String(owner.user_id));
        const [[order]]: any = await db.query('SELECT user_id,plan_id,period,status FROM t_plan_order WHERE id=? FOR UPDATE', [id]);
        if (!order || String(order.user_id) !== String(owner.user_id))
            throw createError({ statusCode: 409, message: '订单状态变化' });
        if (order.status === 1)
            return { success: true, alreadyConfirmed: true };
        if (order.status !== 0)
            throw createError({ statusCode: 400, message: '订单状态不允许确认' });
        await applyPlanTx(db, String(order.user_id), String(order.plan_id), '购买计划(管理员确认)', order.period === 'yearly' ? 'yearly' : 'monthly', id);
        await db.query('UPDATE t_plan_order SET status=1,paid_at=NOW() WHERE id=? AND status=0', [id]);
        return { success: true };
    });
});
