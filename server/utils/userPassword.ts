import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { createError } from 'h3';
const scrypt = promisify(crypto.scrypt);
const DEFAULT_HASH = crypto.createHash('md5').update('123456').digest('hex');
export function needsPasswordSetup(stored: unknown): boolean { return !stored || stored === DEFAULT_HASH; }
export function validateUserPassword(value: unknown): asserts value is string {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128 || value === '12345678')
        throw createError({ statusCode: 400, message: '密码需为8至128位，不能使用常见默认密码' });
}
export async function hashUserPassword(plain: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    return `scrypt:${salt}:${(await scrypt(plain, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyUserPassword(plain: unknown, stored: string): Promise<boolean> {
    if (typeof plain !== 'string' || plain.length > 128 || needsPasswordSetup(stored))
        return false;
    if (/^[a-f0-9]{32}$/.test(stored))
        return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), crypto.createHash('md5').update(plain).digest());
    const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
    if (!match)
        return false;
    return crypto.timingSafeEqual(await scrypt(plain, match[1]!, 64) as Buffer, Buffer.from(match[2]!, 'hex'));
}
