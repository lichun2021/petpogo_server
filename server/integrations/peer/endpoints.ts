// 客户端可调用的 Peer 接口清单。路径、编码和参数集中维护，不开放任意代理。
export interface PeerEndpoint {
  path: string
  method: 'GET' | 'POST'
  encoding: 'query' | 'form' | 'json' | 'empty'
  fields: string[]
  required: string[]
  oneOf?: string[]
  public?: boolean
}

const form = (path: string, required = '', optional = '', oneOf?: string): PeerEndpoint => ({
  path, method: 'POST', encoding: 'form',
  fields: `${required} ${optional}`.split(' ').filter(Boolean),
  required: required.split(' ').filter(Boolean),
  oneOf: oneOf?.split(' '),
})
const query = (path: string, fields = '', required = ''): PeerEndpoint => ({
  path, method: 'GET', encoding: 'query',
  fields: fields.split(' ').filter(Boolean), required: required.split(' ').filter(Boolean),
})

export const peerEndpoints: readonly PeerEndpoint[] = [
  // 设备（15）
  form('/user/device/list'),
  form('/user/device/detail', 'mac'),
  query('/user/device/online/state', 'mac', 'mac'),
  form('/user/device/update', 'mac deviceNickName'),
  form('/user/device/unbind', 'mac'),
  form('/user/device/qr/token'),
  form('/device/product/list'),
  form('/user/device/member/query', 'mac'),
  form('/user/device/member/remove', 'deviceId userId'),
  form('/device/share/push/add', 'deviceId', 'type email'),
  form('/user/device/accept', 'order'),
  form('/user/device/bind', 'mac', 'deviceNickName'),
  form('/user/device/mcuota/get', 'mac'),
  form('/device/shadow/update', 'mac data'),
  form('/pet/agora/getToken', 'mac loginCustomerId'),
  // 宠物与围栏（10）：沿用 Peer ID；添加/删除成功后同步本地档案。
  form('/pet/info/list'),
  form('/pet/info/get', '', 'mac deviceId', 'mac deviceId'),
  form('/pet/info/add', 'petName', 'mac deviceId breed weight sex avatar age'),
  form('/pet/info/update', 'petId', 'petName breed weight sex avatar age'),
  form('/pet/info/del', '', 'petId deviceId', 'petId deviceId'),
  form('/pet/position', '', 'lang mac deviceId', 'mac deviceId'),
  form('/pet/fence/list', '', 'mac deviceId', 'mac deviceId'),
  form('/pet/fence/add', 'fenceName longitude latitude radius address', 'mac deviceId street coordinateType', 'mac deviceId'),
  form('/pet/fence/update', 'fenceId', 'fenceName radius address'),
  form('/pet/fence/del', 'fenceId'),
  // 宠物分享（8）
  form('/pet/share/add', '', 'petId deviceId mac email type', 'petId deviceId mac'),
  form('/pet/share/accept', 'order'),
  form('/pet/share/refuse', '', 'shareId order', 'shareId order'),
  query('/pet/share/mylist', 'pageNo pageSize'),
  query('/pet/share/withme', 'pageNo pageSize'),
  form('/pet/share/del', 'shareId'),
  form('/pet/share/members', 'petId'),
  // 上游路径尚待真实账号联调确认，不改写为其他推测路径。
  form('/pet/share/member/remove', 'petId userId'),
  // 声音（2）：上游要求 JSON。
  { ...form('/pet/sound/play', 'mac url', 'volume'), encoding: 'json' },
  { ...form('/pet/sound/stop', 'mac'), encoding: 'json' },
  // 国家地区（2）：免登录，仍由 SDKAPI 中间件校验应用签名。
  { ...form('/world/country/list'), encoding: 'empty', public: true },
  { ...query('/world/country/default'), public: true },
]
