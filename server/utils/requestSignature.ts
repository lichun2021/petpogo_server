import crypto from 'node:crypto';
import { getHeader, createError, type H3Event } from 'h3';
import { readProxyBody } from '../integrations/shared/bounds';
/** 查询按名称稳定排序，重复同名参数保持原顺序；正文使用原始字节。 */
export function signatureMessage(method: string, target: string, timestamp: string, nonce: string, keyId: string, body: Buffer): string {
    const url = new URL(target, 'http://signature.local');
    url.searchParams.sort();
    return ['2', keyId, method.toUpperCase(), url.pathname, url.searchParams.toString(), timestamp, nonce, crypto.createHash('sha256').update(body).digest('hex')].join('\n');
}
export async function verifyRequestSignatureV2(event: H3Event, surface: 'sdkapi' | 'openapi', secret: string): Promise<boolean> {
    const version = getHeader(event, 'x-signature-version');
    if (!version || version === '1')
        return false;
    if (version !== '2')
        throw createError({ statusCode: 400, message: '签名版本不支持' });
    const timestamp = getHeader(event, 'x-timestamp') || '', nonce = getHeader(event, 'x-nonce') || '', keyId = getHeader(event, 'x-key-id') || '';
    const signature = getHeader(event, 'x-signature') || '';
    if (keyId !== 'primary' || !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature))
        throw createError({ statusCode: 403, message: '签名参数无效或过期' });
    if (!secret)
        throw createError({ statusCode: 503, message: '签名密钥未配置' });
    const body = await readProxyBody(event);
    const expected = crypto.createHmac('sha256', secret).update(signatureMessage(event.method, event.path, timestamp, nonce, keyId, body)).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
        throw createError({ statusCode: 403, message: '签名验证失败' });
    const ttl = Math.max(1, Math.ceil((Number(timestamp) + 300000 - Date.now()) / 1000));
    const accepted = await useRedis().set(RedisKey.signatureNonce(surface, keyId, nonce), '1', 'EX', ttl, 'NX');
    if (accepted !== 'OK')
        throw createError({ statusCode: 403, message: '请求已处理，请勿重放' });
    return true;
}
