import type { PoolConnection } from 'mysql2/promise';
import { createError } from 'h3';
export async function withTransaction<T>(work: (db: PoolConnection) => Promise<T>): Promise<T> {
    const db = await useDb().getConnection();
    try {
        await db.beginTransaction();
        const result = await work(db);
        await db.commit();
        return result;
    }
    catch (error) {
        await db.rollback();
        throw error;
    }
    finally {
        db.release();
    }
}
/** 所有积分及权益写操作的共同锁；即使没有批次也可以串行。 */
export async function lockPointsUser(db: PoolConnection, userId: string | bigint) {
    const [[user]]: any = await db.query('SELECT id,last_grant_at,plan_type,plan_expire_at FROM t_user WHERE id=? AND deleted=0 FOR UPDATE', [String(userId)]);
    if (!user)
        throw createError({ statusCode: 404, message: '用户不存在' });
    return user;
}
