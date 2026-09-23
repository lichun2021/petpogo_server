<template>
  <div class="admin-shell flex h-screen overflow-hidden bg-[#f7f7f5]">
    <aside class="w-16 lg:w-52 shrink-0 flex flex-col border-r border-stone-200 bg-white">
      <div class="h-16 flex items-center gap-3 px-4 shrink-0">
        <div class="size-8 rounded-xl flex items-center justify-center bg-amber-600 text-white shrink-0">
          <UIcon name="i-heroicons-heart" class="size-5" />
        </div>
        <div class="hidden lg:block">
          <p class="font-semibold text-base text-stone-900">萌宠帮</p>
          <p class="text-xs text-stone-500">管理后台</p>
        </div>
      </div>
      <nav aria-label="后台导航" class="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        <section v-for="section in navSections" :key="section.label">
          <p class="hidden lg:block px-3 pt-2 pb-1.5 text-xs text-stone-500">{{ section.label }}</p>
          <button v-for="item in section.items" :key="item.to" :title="item.label"
            :aria-current="isNavActive(item.to) ? 'page' : undefined"
            :class="['w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left focus-visible:outline-2 focus-visible:outline-amber-700', isNavActive(item.to) ? 'bg-amber-50 text-amber-800 font-semibold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900']"
            @click="openTab(item.to)">
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            <span class="hidden lg:inline">{{ item.label }}</span>
          </button>
        </section>
      </nav>
      <div class="p-3 border-t border-stone-200 shrink-0 flex items-center gap-2">
        <div class="hidden lg:flex size-8 rounded-full bg-stone-100 items-center justify-center text-stone-600"><UIcon name="i-heroicons-user" class="size-4" /></div>
        <span class="hidden lg:block flex-1 text-sm text-stone-600">管理员</span>
        <UButton icon="i-heroicons-arrow-right-on-rectangle" color="neutral" variant="ghost" aria-label="退出登录" title="退出登录" @click="logout" />
      </div>
    </aside>
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <nav aria-label="已打开页面" class="h-12 shrink-0 flex items-center border-b border-stone-200 bg-white px-3 gap-2">
        <div class="flex-1 min-w-0 overflow-x-auto h-full flex items-center gap-1">
          <div v-for="tab in tabs" :key="tab.path" :class="['group flex items-center h-9 rounded-lg shrink-0', activeTab === tab.path ? 'bg-amber-50 text-amber-800' : 'text-stone-500 hover:bg-stone-50']" @contextmenu.prevent="openContextMenu($event, tab)">
            <button class="flex items-center gap-2 h-full pl-3 pr-2 text-sm rounded-lg focus-visible:outline-2 focus-visible:outline-amber-700" :aria-current="activeTab === tab.path ? 'page' : undefined" @click="switchTab(tab.path)">
              <UIcon :name="tab.icon || 'i-heroicons-document'" class="size-4 shrink-0" /><span class="max-w-40 truncate">{{ tab.title }}</span>
            </button>
            <button v-if="tab.closable" class="mr-1 p-1 rounded text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-amber-700" :aria-label="`关闭${tab.title}`" @click="closeTab(tab.path)"><UIcon name="i-heroicons-x-mark" class="size-3 block" /></button>
          </div>
        </div>
        <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" title="关闭所有标签" aria-label="关闭所有标签" @click="closeAll()" />
      </nav>
      <main class="admin-content flex-1 overflow-y-auto p-4 lg:p-6">
        <NuxtPage :keepalive="keepAliveOptions" />
      </main>
    </div>
    <div v-if="contextMenu.show" class="fixed z-50 bg-white rounded-lg shadow-lg border border-stone-200 py-1.5 w-40 text-sm overflow-hidden" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @mouseleave="contextMenu.show = false">
      <button v-for="action in contextMenuActions" :key="action.key" :class="['w-full text-left px-3.5 py-2 flex items-center gap-2', action.danger ? 'text-red-600 hover:bg-red-50' : 'text-stone-600 hover:bg-stone-50']" @click="handleContextAction(action.key)"><UIcon :name="action.icon" class="size-4" />{{ action.label }}</button>
    </div>
    <div v-if="contextMenu.show" class="fixed inset-0 z-40" @click="contextMenu.show = false" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { tabs, activeTab, openTab, closeTab, closeOthers, closeAll, syncRoute } = useTabStore()

const isSuperAdmin = ref(false)
onMounted(() => {
  isSuperAdmin.value = localStorage.getItem('admin_role') === 'super_admin'
})

const navBase = [
  { to: '/admin',          label: '数据概览',    icon: 'i-heroicons-squares-2x2' },
  { to: '/admin/users',    label: '用户管理',    icon: 'i-heroicons-users' },
  { to: '/admin/devices',  label: '设备管理',    icon: 'i-heroicons-cpu-chip' },
  { to: '/admin/device-events', label: '设备事件', icon: 'i-heroicons-bell-alert' },
  { to: '/admin/pets',     label: '宠物档案',    icon: 'i-heroicons-heart' },
  { to: '/admin/virtual-pet/scenes', label: '电子宠物环境', icon: 'i-heroicons-sparkles' },
  { to: '/admin/virtual-pet/assignment', label: '宠物形象分配', icon: 'i-heroicons-adjustments-horizontal' },
  { to: '/admin/virtual-pet/actions', label: '硬件动作管理', icon: 'i-heroicons-bolt' },
  { to: '/admin/virtual-pet/events', label: '宠物事件查询', icon: 'i-heroicons-clock' },
  { to: '/admin/posts',    label: '帖子审核',    icon: 'i-heroicons-photo' },
  { to: '/admin/stores',   label: '门店管理',    icon: 'i-heroicons-building-storefront' },
  { to: '/admin/ai-analysis', label: 'AI 识别记录', icon: 'i-heroicons-sparkles' },
  { to: '/admin/plans',    label: '购买计划',    icon: 'i-heroicons-credit-card' },
  { to: '/admin/points/config', label: '积分类型', icon: 'i-heroicons-clock' },
  { to: '/admin/points/rules', label: '积分规则', icon: 'i-heroicons-star' },
  { to: '/admin/checkin/rules', label: '签到奖励', icon: 'i-heroicons-calendar-days' },
  { to: '/admin/music',    label: '宠物音乐',    icon: 'i-heroicons-musical-note' },
  { to: '/admin/sound',    label: '情绪声音',    icon: 'i-heroicons-speaker-wave' },
  { to: '/admin/media',    label: '用户图库',    icon: 'i-heroicons-photo' },
  { to: '/admin/feedback', label: '用户反馈',    icon: 'i-heroicons-chat-bubble-left-ellipsis' },
  { to: '/admin/push',     label: '推送测试',    icon: 'i-heroicons-bell' },
  { to: '/admin/settings', label: '系统设置',    icon: 'i-heroicons-cog-6-tooth' },
]

const nav = computed(() => isSuperAdmin.value
  ? [...navBase, { to: '/admin/admins', label: '管理员管理', icon: 'i-heroicons-shield-check' }]
  : navBase)


const navSections = computed(() => {
  const groups = [
    { label: '业务管理', paths: ['/admin', '/admin/users', '/admin/devices', '/admin/device-events', '/admin/pets', '/admin/stores'] },
    { label: '宠物与内容', paths: ['/admin/virtual-pet/scenes', '/admin/virtual-pet/assignment', '/admin/virtual-pet/actions', '/admin/virtual-pet/events', '/admin/posts', '/admin/ai-analysis', '/admin/music', '/admin/sound', '/admin/media'] },
    { label: '订阅与积分', paths: ['/admin/plans', '/admin/points/config', '/admin/points/rules', '/admin/checkin/rules'] },
    { label: '系统管理', paths: ['/admin/feedback', '/admin/push', '/admin/settings', '/admin/admins'] },
  ]
  return groups.map(group => ({ ...group, items: nav.value.filter(item => group.paths.includes(item.to)) }))
})

// KeepAlive 配置：缓存所有已打开的 tab 页面组件
const keepAliveOptions = computed(() => ({
  max: 15,  // 最多缓存15个组件
}))

function isNavActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path.startsWith(to)
}

function switchTab(path: string) {
  activeTab.value = path
  navigateTo(path)
}

// 监听路由变化，同步 tab 激活状态
watch(() => route.path, (path) => {
  if (path.startsWith('/admin') && path !== '/admin/login') {
    syncRoute(path)
  }
}, { immediate: true })

// ── 右键菜单 ──────────────────────────────────────
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  tab: null as TabItem | null,
})

const contextMenuActions = computed(() => {
  const tab = contextMenu.tab
  const actions = []
  if (tab?.closable) {
    actions.push({ key: 'close',  label: '关闭标签',    icon: 'i-heroicons-x-mark',       danger: false })
  }
  actions.push({ key: 'others', label: '关闭其他标签', icon: 'i-heroicons-x-circle',      danger: false })
  actions.push({ key: 'all',    label: '关闭全部标签', icon: 'i-heroicons-trash',          danger: true  })
  return actions
})

function openContextMenu(e: MouseEvent, tab: TabItem) {
  contextMenu.tab  = tab
  contextMenu.x    = Math.min(e.clientX, window.innerWidth  - 170)
  contextMenu.y    = Math.min(e.clientY, window.innerHeight - 160)
  contextMenu.show = true
}

function handleContextAction(key: string) {
  const tab = contextMenu.tab
  contextMenu.show = false
  if (!tab) return
  if (key === 'close')  closeTab(tab.path)
  if (key === 'others') closeOthers(tab.path)
  if (key === 'all')    closeAll()
}

function logout() {
  const token = localStorage.getItem('admin_token')
  if (token) {
    $fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_id')
  localStorage.removeItem('admin_role')
  localStorage.removeItem('admin_username')
  navigateTo('/admin/login')
}
</script>
