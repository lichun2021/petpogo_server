import type { Pool } from 'mysql2/promise'
import { parseResourceJson } from '../shared/json.ts'

/** 仅装饰上游已授权返回的设备，不从本地追加设备；长整数按字符串保留精度。 */
export async function enrichDeviceNetwork(db: Pick<Pool, 'query'>, body: string, status: number): Promise<string> {
  if (status < 200 || status >= 300) return body
  const data = parseResourceJson(body)
  if (String(data?.code) !== '0') return body
  const devices = Array.isArray(data.info) ? data.info : data.list
  if (!Array.isArray(devices)) return body
  const ids = [...new Set(devices.map((d: any) => String(d?.deviceId ?? d?.id ?? '')).filter((id: string) => /^[1-9]\d{0,18}$/.test(id)))] as string[]
  const local = new Map<string, any>()
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200)
    const [rows]: any = await db.query(`SELECT id,mac,network_type FROM t_device WHERE deleted=0 AND id IN (${batch.map(() => '?').join(',')})`, batch)
    for (const row of rows) local.set(String(row.id), row)
  }
  for (const device of devices) {
    if (!device || typeof device !== 'object' || Array.isArray(device)) continue
    const row = local.get(String(device.deviceId ?? device.id ?? ''))
    device.networkType = row && (!device.mac || device.mac === row.mac) && ['4g', 'wifi'].includes(row.network_type)
      ? row.network_type : null
  }
  return JSON.stringify(data)
}
