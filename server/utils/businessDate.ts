import { createError } from 'h3';
const DAY = 86400000;
/** 明确北京时间，独立于 Node 进程 TZ。 */
export function businessDate(value: Date | number = new Date()): string {
    return new Date(Number(value) + 8 * 3600000).toISOString().slice(0, 10);
}
export function businessDateTime(value: Date | number = new Date()): string {
    return new Date(Number(value) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}
export function parseBusinessDate(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
        throw createError({ statusCode: 400, message: '日期格式无效，应为有效的 YYYY-MM-DD' });
    }
    return value;
}
export function addBusinessDays(date: string, days: number): string {
    return new Date(Date.parse(parseBusinessDate(date)) + days * DAY).toISOString().slice(0, 10);
}
export function businessMonday(date = businessDate()): string {
    return addBusinessDays(date, -((new Date(date).getUTCDay() + 6) % 7));
}
export function businessTimestamp(value: string | Date): number {
    return value instanceof Date ? value.getTime() : Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + '+08:00');
}
