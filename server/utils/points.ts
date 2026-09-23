import type { PoolConnection } from 'mysql2/promise';
import { createError } from 'h3';
import { withTransaction, lockPointsUser } from './transaction';
import { businessDate, businessDateTime, businessTimestamp, addBusinessDays } from './businessDate';
export const POINTS_TYPE_WEEKLY = 1;
export const POINTS_TYPE_PERMANENT = 2;
export interface PointsBatch {
    id: string;
    typeCode: string;
    remaining: number;
    expireAt: string | null;
    reason: string | null;
}
export interface PointsBalance {
    expiring: number;
    permanent: number;
    total: number;
    batches: PointsBatch[];
}
export function validatePointsAmount(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647)
        throw createError({ statusCode: 400, message: '积分数量必须为有效正整数' });
}
/** 调用者必须已经持有该用户行锁，事务内不得另取池连接。 */
export async function readPointsBalanceTx(db: PoolConnection, userId: string | bigint): Promise<PointsBalance> {
    const [rows]: any = await db.query('SELECT id,type_code,remaining,expire_at,reason FROM t_user_points_batch WHERE user_id=? AND remaining>0 AND (expire_at IS NULL OR expire_at>NOW()) ORDER BY (expire_at IS NULL),expire_at,id', [String(userId)]);
    const batches: PointsBatch[] = rows.map((b: any) => ({ id: String(b.id), typeCode: b.type_code, remaining: Number(b.remaining), expireAt: b.expire_at, reason: b.reason }));
    const expiring = batches.filter(b => b.expireAt !== null).reduce((n, b) => n + b.remaining, 0);
    const permanent = batches.filter(b => b.expireAt === null).reduce((n, b) => n + b.remaining, 0);
    return { expiring, permanent, total: expiring + permanent, batches };
}
export async function grantPointsBatchTx(db: PoolConnection, userId: string | bigint, amount: number, typeCode: string, reason: string, refType?: string, refId?: string): Promise<PointsBalance> {
    validatePointsAmount(amount);
    const [[cfg]]: any = await db.query('SELECT expire_days FROM t_points_config WHERE type_code=? AND status=1', [typeCode]);
    if (!cfg)
        throw createError({ statusCode: 400, message: '积分类型不存在或已停用' });
    const days = Number(cfg.expire_days);
    if (!Number.isSafeInteger(days) || days < 0 || days > 36500)
        throw createError({ statusCode: 400, message: '积分有效期配置无效' });
    const expireAt = days ? businessDateTime(Date.now() + days * 86400000) : null;
    await db.query('INSERT INTO t_user_points_batch (user_id,type_code,granted_amount,remaining,expire_at,reason,ref_type,ref_id) VALUES(?,?,?,?,?,?,?,?)', [String(userId), typeCode, amount, amount, expireAt, reason, refType || null, refId || null]);
    await db.query('INSERT INTO t_points_log (user_id,direction,type_code,points_type,amount,balance_after,expire_at,reason,ref_type,ref_id) VALUES(?,1,?,NULL,?,?,?,?,?,?)', [String(userId), typeCode, amount, amount, expireAt, reason, refType || null, refId || null]);
    return readPointsBalanceTx(db, userId);
}
/** cron、登录与余额入口统一走这里；用户锁使周期检查和推进原子化。 */
export async function ensurePeriodGrantTx(db: PoolConnection, userId: string | bigint, user: any): Promise<boolean> {
    const type = user.plan_expire_at && businessTimestamp(user.plan_expire_at) < Date.now() ? 0 : Number(user.plan_type || 0);
    let [[plan]]: any = await db.query('SELECT * FROM t_plan WHERE plan_type=? AND status=1', [type]);
    if (!plan && type !== 0)
        [[plan]] = await db.query('SELECT * FROM t_plan WHERE plan_type=0 AND status=1') as any;
    const days = Number(plan?.grant_period_days || 7);
    if (!Number.isSafeInteger(days) || days < 1 || days > 36500)
        throw createError({ statusCode: 400, message: '积分发放周期配置无效' });
    const lastDate = user.last_grant_at ? (user.last_grant_at instanceof Date ? businessDate(user.last_grant_at) : String(user.last_grant_at).slice(0, 10)) : null;
    if (lastDate && businessDate() < addBusinessDays(lastDate, days))
        return false;
    const amount = Number(plan?.period_grant_amount || 0);
    if (amount > 0)
        await grantPointsBatchTx(db, userId, amount, plan.period_grant_type_code || 'plan_free', '计划周期赠送积分', 'plan_period', businessDate());
    await db.query('UPDATE t_user SET last_grant_at=NOW() WHERE id=?', [String(userId)]);
    return amount > 0;
}
export async function ensurePeriodGrant(userId: string | bigint): Promise<void> {
    await withTransaction(async (db) => { const user = await lockPointsUser(db, userId); await ensurePeriodGrantTx(db, userId, user); });
}
export async function grantScheduledPoints(batchSize = 500) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 5000)
        throw createError({ statusCode: 400, message: 'batchSize 必须为1至5000的整数' });
    const [rows]: any = await useDb().query(`SELECT u.id FROM t_user u
    LEFT JOIN t_plan p ON p.plan_type=CASE WHEN u.plan_expire_at IS NOT NULL AND u.plan_expire_at<NOW() THEN 0 ELSE u.plan_type END AND p.status=1
    LEFT JOIN t_plan f ON f.plan_type=0 AND f.status=1
    WHERE u.deleted=0 AND (u.last_grant_at IS NULL OR DATEDIFF(CURDATE(),DATE(u.last_grant_at))>=COALESCE(p.grant_period_days,f.grant_period_days,7))
    ORDER BY u.last_grant_at,u.id LIMIT ?`, [batchSize]);
    let granted = 0;
    for (const row of rows)
        if (await withTransaction(async (db) => ensurePeriodGrantTx(db, String(row.id), await lockPointsUser(db, String(row.id)))))
            granted++;
    return { scanned: rows.length, granted };
}
export async function grantPointsBatch(userId: string | bigint, amount: number, typeCode: string, reason: string, refType?: string, refId?: string): Promise<PointsBalance> {
    return withTransaction(async (db) => { const user = await lockPointsUser(db, userId); await ensurePeriodGrantTx(db, userId, user); return grantPointsBatchTx(db, userId, amount, typeCode, reason, refType, refId); });
}
export async function getPointsBalance(userId: string | bigint): Promise<PointsBalance> {
    return withTransaction(async (db) => {
        const user = await lockPointsUser(db, userId);
        await ensurePeriodGrantTx(db, userId, user);
        await db.query('UPDATE t_user_points_batch SET remaining=0 WHERE user_id=? AND expire_at IS NOT NULL AND expire_at<=NOW() AND remaining>0', [String(userId)]);
        return readPointsBalanceTx(db, userId);
    });
}
export async function spendPointsTx(db: PoolConnection, userId: string | bigint, amount: number, reason: string, refType?: string, refId?: string): Promise<PointsBalance> {
    validatePointsAmount(amount);
    const [batches]: any = await db.query('SELECT id,type_code,remaining,expire_at FROM t_user_points_batch WHERE user_id=? AND remaining>0 AND (expire_at IS NULL OR expire_at>NOW()) ORDER BY (expire_at IS NULL),expire_at,id FOR UPDATE', [String(userId)]);
    const available = batches.reduce((n: number, b: any) => n + Number(b.remaining), 0);
    if (available < amount)
        throw createError({ statusCode: 402, message: `积分不足，当前剩余 ${available} 分，需要 ${amount} 分`, data: { expiring: available } });
    let remaining = amount;
    for (const b of batches) {
        if (!remaining)
            break;
        const take = Math.min(Number(b.remaining), remaining), after = Number(b.remaining) - take;
        const [changed]: any = await db.query('UPDATE t_user_points_batch SET remaining=remaining-? WHERE id=? AND remaining>=?', [take, String(b.id), take]);
        if (changed.affectedRows !== 1)
            throw createError({ statusCode: 409, message: '积分状态变化，请重试' });
        await db.query('INSERT INTO t_points_log (user_id,direction,type_code,points_type,amount,balance_after,expire_at,reason,ref_type,ref_id) VALUES(?,2,?,NULL,?,?,?,?,?,?)', [String(userId), b.type_code, take, after, b.expire_at, reason, refType || null, refId || null]);
        remaining -= take;
    }
    return readPointsBalanceTx(db, userId);
}
export async function spendPoints(userId: string | bigint, amount: number, reason: string, refType?: string, refId?: string): Promise<PointsBalance> {
    return withTransaction(async (db) => { const user = await lockPointsUser(db, userId); await ensurePeriodGrantTx(db, userId, user); return spendPointsTx(db, userId, amount, reason, refType, refId); });
}
export async function grantPoints(userId: string | bigint, amount: number, pointsType: number, reason: string, refType?: string, refId?: string) {
    return grantPointsBatch(userId, amount, pointsType === POINTS_TYPE_PERMANENT ? 'permanent' : 'plan_free', reason, refType, refId);
}
