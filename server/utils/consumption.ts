import crypto from 'node:crypto';
import { createError } from 'h3';
/** 当前数据库只存整数积分；拒绝无效或需隐式取整的费用，不悄悄改变价格。 */
export function consumptionCost(unitPoints: number, quantity: unknown): number {
    const text = String(quantity ?? 1);
    if (!/^\d{1,9}(\.\d{1,6})?$/.test(text) || !Number.isSafeInteger(unitPoints) || unitPoints <= 0)
        throw createError({ statusCode: 400, message: '消费数量或单价无效' });
    const [whole, fraction = ''] = text.split('.');
    const divisor = 10n ** BigInt(fraction.length), value = BigInt(whole! + fraction) * BigInt(unitPoints);
    if (value <= 0n || value % divisor !== 0n || value / divisor > 2147483647n)
        throw createError({ statusCode: 400, message: '消费金额必须为有效整数积分，请确认数量单位' });
    return Number(value / divisor);
}
export async function consumePointsEvent(userId: string, source: string, eventId: string, consumeType: string, quantity: unknown) {
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(eventId))
        throw createError({ statusCode: 400, message: '必须提供稳定的 refId，最长100位' });
    // 数量用十进制规范文本；同 ID 的请求不能改变用户、类型或数量。
    const qty = String(quantity ?? 1);
    if (!/^\d{1,9}(\.\d{1,6})?$/.test(qty) || Number(qty) <= 0)
        throw createError({ statusCode: 400, message: '消费数量无效' });
    const hash = crypto.createHash('sha256').update(JSON.stringify([userId, consumeType, String(Number(qty))])).digest('hex');
    return withTransaction(async (db) => {
        const user = await lockPointsUser(db, userId);
        await db.query('INSERT INTO t_points_operation(source,event_id,user_id,request_hash) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE id=id', [source, eventId, userId, hash]);
        const [[operation]]: any = await db.query('SELECT id,request_hash,result FROM t_points_operation WHERE source=? AND event_id=? FOR UPDATE', [source, eventId]);
        if (operation.request_hash !== hash)
            throw createError({ statusCode: 409, message: '同一 refId 不允许改变消费内容' });
        if (operation.result)
            return typeof operation.result === 'string' ? JSON.parse(operation.result) : operation.result;
        const [[rule]]: any = await db.query('SELECT * FROM t_points_consume_rule WHERE consume_type=? AND status=1', [consumeType]);
        if (!rule)
            throw createError({ statusCode: 400, message: '消费规则未配置' });
        const cost = consumptionCost(Number(rule.unit_points), rule.unit_basis === 'per_unit' ? qty : 1);
        await ensurePeriodGrantTx(db, userId, user);
        let result;
        try {
            const balance = await spendPointsTx(db, userId, cost, rule.name, 'ai_consumption', String(operation.id));
            result = { success: true, deducted: cost, balance };
        }
        catch (error: any) {
            if (error.statusCode !== 402)
                throw error;
            result = { success: false, deducted: 0, message: error.message, balance: await readPointsBalanceTx(db, userId) };
        }
        await db.query('UPDATE t_points_operation SET result=?,amount=?,rule_snapshot=? WHERE id=?', [JSON.stringify(result), cost, JSON.stringify(rule), String(operation.id)]);
        return result;
    });
}
