import type { H3Event } from 'h3';
import { createError, getHeader } from 'h3';
import { peerRequest } from './peerBackend';
import { parseResourceJson } from '../integrations/shared/json';
/** 数字 ID 与 MAC 分开解析，只有上游确认的所有者才能变更关联。 */
export async function assertDeviceAccess(event: H3Event, deviceId: unknown, write = false) {
    if (typeof deviceId !== 'string' || !/^[1-9]\d{0,18}$/.test(deviceId))
        throw createError({ statusCode: 400, message: '设备 ID 必须为数字字符串' });
    const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!token)
        throw createError({ statusCode: 401, message: '请先登录' });
    const response = await peerRequest('/user/device/list', { method: 'POST', encoding: 'form', params: {}, token });
    const data = parseResourceJson(response.body);
    const devices = Array.isArray(data?.info) ? data.info : data?.list;
    if (response.status < 200 || response.status >= 300 || String(data?.code) !== '0' || !Array.isArray(devices))
        throw createError({ statusCode: 503, message: '暂时无法确认设备权限' });
    const [[local]]: any = await useDb().query('SELECT mac FROM t_device WHERE id=? AND deleted=0', [deviceId]);
    const device = devices.find((d: any) => String(d.deviceId ?? d.id ?? '') === deviceId && (!local || String(d.mac) === local.mac));
    if (!device || (write && String(device.uType) !== '1'))
        throw createError({ statusCode: 403, message: write ? '只有设备所有者可修改关联或围栏' : '无权访问该设备' });
    return device;
}
