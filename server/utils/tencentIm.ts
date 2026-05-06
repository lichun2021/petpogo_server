// 腾讯云 IM REST API 封装
// SDKAppID: 1600139420 (体验版，100用户上限，测试专用)
// 上线后替换 SDKAppID 和 adminKey 即可，代码无需改动

import TLSSigAPIv2 from 'tls-sig-api-v2'
import axios from 'axios'

const ADMIN_ID = 'administrator'
const IM_BASE  = 'https://console.tim.qq.com/v4'

function getImConfig() {
  const c = useRuntimeConfig()
  return {
    sdkAppId: Number(c.tencentImSdkAppId || '1600139420'),
    adminKey:  String(c.tencentImAdminKey || 'f10fd3888e0c707830bf398bd51ffa6be657aeff601905c0f5230e0f82907775'),
  }
}

/** 生成 UserSig（后端专用，严禁在前端调用） */
export function genUserSig(userId: string, expire = 86400 * 7): string {
  const { sdkAppId, adminKey } = getImConfig()
  const api = new TLSSigAPIv2.Api(sdkAppId, adminKey)
  return api.genSig(String(userId), expire)
}

/** 管理员 UserSig（用于 REST API 鉴权） */
function getAdminSig(): string {
  return genUserSig(ADMIN_ID, 86400)
}

/** REST API 通用请求 */
async function imRequest<T = any>(path: string, data: object): Promise<T> {
  const { sdkAppId } = getImConfig()
  const url = `${IM_BASE}/${path}?sdkappid=${sdkAppId}&identifier=${ADMIN_ID}&usersig=${getAdminSig()}&random=${Math.floor(Math.random() * 1e9)}&contenttype=json`
  const res = await axios.post(url, data, { timeout: 5000 })
  if (res.data.ActionStatus !== 'OK') {
    console.error(`IM API Error [${path}]:`, res.data.ErrorInfo)
    throw new Error(`腾讯IM错误: ${res.data.ErrorInfo}`)
  }
  return res.data
}

// ========== 账号管理 ==========

/** 注册时导入 IM 账号（异步调用，不阻塞登录） */
export async function imImportAccount(userId: string, nickname: string, avatar = '') {
  return imRequest('im_open_login_svc/account_import', {
    Identifier: String(userId),
    Nick:        nickname,
    FaceUrl:     avatar,
  })
}

// ========== 单聊 ==========

/** 发送系统单聊消息（围栏告警/互动通知等） */
export async function imSendMsg(params: {
  toUserId: string
  msgType?: 'TIMTextElem' | 'TIMCustomElem'
  content:  string | Record<string, any>
}) {
  const type = params.msgType || 'TIMTextElem'
  const msgBody = type === 'TIMTextElem'
    ? [{ MsgType: 'TIMTextElem', MsgContent: { Text: params.content } }]
    : [{ MsgType: 'TIMCustomElem', MsgContent: { Data: JSON.stringify(params.content), Desc: '' } }]

  return imRequest('openim/sendmsg', {
    From_Account: ADMIN_ID,
    To_Account:   String(params.toUserId),
    MsgRandom:    Math.floor(Math.random() * 1e9),
    MsgBody:      msgBody,
    OfflinePushInfo: {
      PushFlag: 0,
      Title:    '宠物助手',
      Desc:     typeof params.content === 'string' ? params.content : '您有新消息',
    },
  })
}

// ========== 群组 ==========

/** 创建群组（商店客服群/社区群） */
export async function imCreateGroup(params: {
  groupId:        string
  name:           string
  type?:          'Public' | 'Private' | 'ChatRoom' | 'Community'
  ownerUserId?:   string
  introduction?:  string
  maxMemberCount?: number
}) {
  return imRequest('group_open_http_svc/create_group', {
    Owner_Account:  params.ownerUserId || ADMIN_ID,
    Type:           params.type || 'ChatRoom',
    GroupId:        params.groupId,
    Name:           params.name,
    Introduction:   params.introduction || '',
    MaxMemberCount: params.maxMemberCount || 500,
  })
}

/** 发送群消息 */
export async function imSendGroupMsg(
  groupId:  string,
  content:  string | Record<string, any>,
  msgType:  'TIMTextElem' | 'TIMCustomElem' = 'TIMTextElem'
) {
  const msgBody = msgType === 'TIMTextElem'
    ? [{ MsgType: 'TIMTextElem', MsgContent: { Text: content } }]
    : [{ MsgType: 'TIMCustomElem', MsgContent: { Data: JSON.stringify(content) } }]
  return imRequest('group_open_http_svc/send_group_msg', {
    GroupId:      groupId,
    From_Account: ADMIN_ID,
    MsgBody:      msgBody,
  })
}

/** 添加群成员 */
export async function imAddGroupMember(groupId: string, userIds: string[]) {
  return imRequest('group_open_http_svc/add_group_member', {
    GroupId:    groupId,
    MemberList: userIds.map(id => ({ Member_Account: String(id) })),
  })
}

// 消息类型常量（与 App 端约定）
export const IM_MSG_TYPE = {
  FENCE_ALERT:    'fence_alert',
  DEVICE_ONLINE:  'device_online',
  DEVICE_OFFLINE: 'device_offline',
  POST_LIKE:      'post_like',
  POST_COMMENT:   'post_comment',
  SYSTEM_NOTICE:  'system_notice',
} as const
