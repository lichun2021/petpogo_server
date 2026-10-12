# SDKAPI 设备通网类型对接说明

更新日期：2026-10-12。范围：本轮设备通网类型改造，不是全部 SDKAPI 接口清单。

## 1. 变更清单

| 接口 | 变更 |
| --- | --- |
| POST /sdkapi/peer/user/device/bind | 新增可选请求字段 networkType，绑定成功后保存本地 |
| POST /sdkapi/peer/user/device/list | 每台设备新增响应字段 networkType |

线上数据库已执行003-device-network-type.mjs，t_device.network_type为可空ENUM('4g','wifi')。现有数据不猜测类型，未上报的设备为NULL。

客户端绑定流程尚未在本轮修改中接入上报。客户端应同时兼容字段缺失和null；实际部署版本以构建日志与启动日志中的buildId为准。

## 2. 公共约定

- 服务地址：`https://api.jxpetai.com`。
- 两个接口均为 **POST**，需要有效的 `Authorization: Bearer <token>` 和现有 SDKAPI 签名头。继续复用客户端公共鉴权/签名拦截器；本轮没有改变签名协议。
- 请求支持 JSON 或表单，建议 `Content-Type: application/json`。
- 客户端传递的通网类型表示设备的通网类型，不是手机当前使用的网络。不能因为手机连着Wi-Fi就把4G设备标为wifi。
- API统一使用驼峰 `networkType`；数据库及后台管理列表使用 `network_type`。
- 值为 `"4g"`、`"wifi"`；服务端将首尾空格去掉并转换为小写。建议客户端直接使用标准值。
- 设备ID用字符串接收和传递，避免长整数精度丢失。

## 3. 绑定设备

`POST /sdkapi/peer/user/device/bind`

| 请求字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| mac | string | 是 | 设备MAC，沿用既有格式 |
| deviceNickName | string | 否 | 设备昵称，沿用既有行为 |
| networkType | string | 否 | 新增：4g或wifi |

Wi-Fi设备示例：

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "deviceNickName": "我的设备",
  "networkType": "wifi"
}
```

4G设备将networkType改为`"4g"`。

处理规则：

1. 先校验networkType，非法非空值或空字符串返回HTTP 400，不调用上游绑定。null按未提供处理。
2. networkType只用于本地档案，不转发给对方后台。
3. 上游绑定成功后，事务中同步t_device和t_user_device，并保存通网类型。
4. 上游未提供有效类型时，旧客户端省略此参数不会清空已有类型；新设备保持null。同步层也能接收上游明确返回的4g/wifi，但不推断其他值。
5. 绑定响应继续原样返回上游内容，不保证其中带有networkType。客户端应通过设备列表读取保存结果。

HTTP 400的提示为：`networkType 只能为 4g 或 wifi`。

若上游已经绑定成功但本地同步失败，返回HTTP 502，错误数据包含：

```json
{
  "code": "PEER_LOCAL_SYNC_FAILED",
  "upstreamApplied": true
}
```

以上为错误响应data部分；此时不要盲目重发绑定，应先核对设备实际绑定状态并处理同步失败。

## 4. 获取设备列表

`POST /sdkapi/peer/user/device/list`

请求体为`{}`，无需额外参数。networkType不放在列表请求中。

响应示例（其他字段继续由上游提供）：

```json
{
  "code": 0,
  "info": [
    {
      "deviceId": "1237250046272094208",
      "mac": "AA:BB:CC:DD:EE:FF",
      "deviceNickname": "我的设备",
      "uType": 1,
      "networkType": "wifi"
    },
    {
      "deviceId": "1237250046272094209",
      "mac": "11:22:33:44:55:66",
      "networkType": null
    }
  ]
}
```

- 保留上游设备数量、顺序、业务字段及共享关系；不会将本地其他设备追加到列表。
- 兼容上游数组位于info或list的结构，不强行转换外层结构。
- 仅在上游HTTP成功且业务code为0时补充字段；业务失败继续原样返回。
- 根据deviceId（或id）查询本地未删除设备；上游提供mac时还会核对MAC。未同步、未设置或ID/MAC不匹配时返回null。
- 超出安全整数范围的数字转成字符串，避免序列化导致设备ID精度损失。原有字符串ID保持字符串。
- 本地数据库查询失败会返回错误，不伪装成成功的空列表。

建议展示：4g → `4G`，wifi → `Wi-Fi`，缺失/null → `未设置`。

## 5. 客户端接入边界

扫码调用本服务bind接口的流程，可直接补传networkType。

部分Wi-Fi/蓝牙配网流程会由硬件直接向对方后台完成绑定，App仅轮询设备列表。这些流程不经过本服务bind接口，因此仅增加此参数无法完成本地建档和类型写入。本轮尚未新增“绑定结果同步/通网类型单独更新”接口；不要为补写类型而重复调用设备绑定。

当前未修改设备详情 `/sdkapi/peer/user/device/detail` 的响应，也没有新增按通网类型筛选的SDK接口。

## 6. 发布与验收

数据库003迁移已在线上执行，无需重复手写ALTER。发布列表增强代码时保留迁移文件及校验和。

建议使用测试设备核对：wifi与4g分别绑定后能读回；省略参数保留原值；非法值返回400且未触发绑定；未同步设备显示未设置；共享设备仍按原列表返回；长ID无变化。

本地验证：绑定同步相关9项测试、代理相关15项测试通过，类型检查与Nuxt构建通过。未进行真实设备端到端绑定测试。
