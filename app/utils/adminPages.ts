/** 导航、标签标题、图标与缓存名称的唯一注册表。 */
export const adminPages = [
  { path: '/admin/pet-circle/schedule', title: '宠物圈发布计划', icon: 'i-heroicons-calendar-days', component: 'AdminMomentSchedule', group: '宠物与内容', hidden: false, superOnly: true },
  {
    "path": "/admin",
    "title": "数据概览",
    "icon": "i-heroicons-squares-2x2",
    "component": "AdminDashboard",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/users",
    "title": "用户管理",
    "icon": "i-heroicons-users",
    "component": "AdminUsersList",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/devices",
    "title": "设备管理",
    "icon": "i-heroicons-cpu-chip",
    "component": "AdminDevicesList",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/device-events",
    "title": "设备事件",
    "icon": "i-heroicons-bell-alert",
    "component": "AdminDeviceEvents",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/posts",
    "title": "帖子审核",
    "icon": "i-heroicons-photo",
    "component": "AdminPostsList",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/stores",
    "title": "门店管理",
    "icon": "i-heroicons-building-storefront",
    "component": "AdminStoresList",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/ai-analysis",
    "title": "AI 识别记录",
    "icon": "i-heroicons-sparkles",
    "component": "AdminAiAnalysis",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/music",
    "title": "宠物音乐",
    "icon": "i-heroicons-musical-note",
    "component": "AdminMusic",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/sound",
    "title": "情绪声音",
    "icon": "i-heroicons-speaker-wave",
    "component": "",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/media",
    "title": "用户图库",
    "icon": "i-heroicons-photo",
    "component": "AdminMedia",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/feedback",
    "title": "用户反馈",
    "icon": "i-heroicons-chat-bubble-left-ellipsis",
    "component": "AdminFeedback",
    "group": "系统管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/push",
    "title": "推送测试",
    "icon": "i-heroicons-bell",
    "component": "AdminPush",
    "group": "系统管理",
    "hidden": false,
    "superOnly": true
  },
  {
    "path": "/admin/settings",
    "title": "系统设置",
    "icon": "i-heroicons-cog-6-tooth",
    "component": "AdminSettings",
    "group": "系统管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/admins",
    "title": "管理员管理",
    "icon": "i-heroicons-shield-check",
    "component": "",
    "group": "系统管理",
    "hidden": false,
    "superOnly": true
  },
  {
    "path": "/admin/plans",
    "title": "购买计划",
    "icon": "i-heroicons-credit-card",
    "component": "AdminPlansList",
    "group": "订阅与积分",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/plans/orders",
    "title": "购买订单",
    "icon": "i-heroicons-receipt-percent",
    "component": "AdminPlanOrders",
    "group": "订阅与积分",
    "hidden": true,
    "superOnly": false
  },
  {
    "path": "/admin/points/config",
    "title": "积分类型",
    "icon": "i-heroicons-clock",
    "component": "AdminPointsConfig",
    "group": "订阅与积分",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/points/rules",
    "title": "积分规则",
    "icon": "i-heroicons-star",
    "component": "AdminPointsRules",
    "group": "订阅与积分",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/points/logs",
    "title": "积分流水",
    "icon": "i-heroicons-clipboard-document-list",
    "component": "AdminPointsLogs",
    "group": "订阅与积分",
    "hidden": true,
    "superOnly": false
  },
  {
    "path": "/admin/checkin/rules",
    "title": "签到奖励",
    "icon": "i-heroicons-calendar-days",
    "component": "AdminCheckinRules",
    "group": "订阅与积分",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/pets",
    "title": "宠物档案",
    "icon": "i-heroicons-heart",
    "component": "AdminPets",
    "group": "业务管理",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/virtual-pet/scenes",
    "title": "电子宠物环境",
    "icon": "i-heroicons-sparkles",
    "component": "AdminVirtualPetScenes",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/virtual-pet/assignment",
    "title": "宠物形象分配",
    "icon": "i-heroicons-adjustments-horizontal",
    "component": "AdminPetModelAssignment",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/virtual-pet/actions",
    "title": "硬件动作管理",
    "icon": "i-heroicons-bolt",
    "component": "AdminVirtualPetActions",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  },
  {
    "path": "/admin/virtual-pet/events",
    "title": "宠物事件查询",
    "icon": "i-heroicons-clock",
    "component": "AdminVirtualPetEvents",
    "group": "宠物与内容",
    "hidden": false,
    "superOnly": false
  }
] as const

export function resolveAdminPage(path: string) {
  const page = adminPages.find(page => page.path === path)
  if (page) return page
  if (path.startsWith('/admin/posts/')) return { title: `帖子 #${path.split('/').pop()}`, icon: 'i-heroicons-document-text', component: '' }
  return { title: '页面', icon: 'i-heroicons-document', component: '' }
}
