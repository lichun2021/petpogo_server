<template>
  <div class="flex h-screen overflow-hidden" style="background: #faf8f5">
    <!-- 侧边栏 -->
    <aside class="w-56 flex-shrink-0 flex flex-col border-r" style="background: #fff8f0; border-color: #f0e6d8">
      <!-- Logo -->
      <div class="h-14 flex items-center gap-3 px-4 border-b flex-shrink-0" style="border-color: #f0e6d8">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-sm"
          style="background: linear-gradient(135deg, #f59e0b, #ea580c)">
          🐾
        </div>
        <div>
          <p class="font-bold text-sm leading-none" style="color: #92400e">萌宠帮</p>
          <p class="text-[10px] mt-0.5" style="color: #c4a882">管理后台</p>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <button
          v-for="item in nav"
          :key="item.to"
          :class="[
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left',
            isNavActive(item.to)
              ? 'text-amber-700 font-semibold'
              : 'text-stone-500 hover:text-stone-700 hover:bg-amber-50'
          ]"
          :style="isNavActive(item.to) ? 'background: #fef3c7; border: 1px solid #fde68a' : 'border: 1px solid transparent'"
          @click="openTab(item.to)"
        >
          <UIcon :name="item.icon" class="w-4 h-4 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- 底部 -->
      <div class="p-3 border-t flex-shrink-0" style="border-color: #f0e6d8">
        <div class="flex items-center gap-2.5 px-2 py-1.5">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style="background: linear-gradient(135deg, #f59e0b, #ea580c)">A</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-stone-700 truncate">管理员</p>
            <p class="text-[10px] text-stone-400">administrator</p>
          </div>
          <button class="text-stone-400 hover:text-red-500 transition-colors" title="退出登录" @click="logout">
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

      <!-- Tab 栏 -->
      <div
        class="flex-shrink-0 flex items-end gap-0 border-b overflow-x-auto"
        style="background: #fff8f0; border-color: #f0e6d8; min-height: 40px"
        @contextmenu.prevent
      >
        <TransitionGroup name="tab" tag="div" class="flex items-end">
          <div
            v-for="tab in tabs"
            :key="tab.path"
            :class="[
              'group relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium cursor-pointer select-none flex-shrink-0 transition-all duration-150 border-t border-l border-r rounded-t-lg -mb-px',
              activeTab === tab.path
                ? 'text-amber-700 bg-white z-10'
                : 'text-stone-400 bg-stone-100/80 hover:text-stone-600 hover:bg-amber-50'
            ]"
            :style="activeTab === tab.path
              ? 'border-color: #f0e6d8; padding-bottom: 9px;'
              : 'border-color: #e2d9d0; padding-bottom: 9px;'"
            @click="switchTab(tab.path)"
            @contextmenu.prevent="openContextMenu($event, tab)"
          >
            <UIcon :name="tab.icon || 'i-heroicons-document'" class="w-3.5 h-3.5 flex-shrink-0" />
            <span class="max-w-[120px] truncate">{{ tab.title }}</span>
            <!-- 关闭按钮 -->
            <button
              v-if="tab.closable"
              :class="[
                'w-4 h-4 rounded flex items-center justify-center transition-all ml-0.5',
                activeTab === tab.path
                  ? 'text-stone-400 hover:text-red-500 hover:bg-red-50'
                  : 'text-transparent group-hover:text-stone-400 hover:!text-red-500 hover:bg-red-50'
              ]"
              @click.stop="closeTab(tab.path)"
            >
              <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
            </button>
            <!-- 活动状态底部指示线 -->
            <div
              v-if="activeTab === tab.path"
              class="absolute bottom-0 left-0 right-0 h-px bg-white"
            />
          </div>
        </TransitionGroup>

        <!-- 更多操作 -->
        <div class="ml-auto flex items-center gap-1 px-2 pb-1.5 flex-shrink-0">
          <UButton
            icon="i-heroicons-x-mark"
            color="gray"
            variant="ghost"
            size="xs"
            title="关闭所有标签"
            @click="closeAll()"
          />
        </div>
      </div>

      <!-- 页面内容 -->
      <main class="flex-1 overflow-y-auto p-5" style="background: #faf8f5">
        <NuxtPage :keepalive="keepAliveOptions" />
      </main>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      class="fixed z-50 bg-white rounded-xl shadow-lg border py-1.5 w-40 text-sm overflow-hidden"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px', borderColor: '#f0e6d8' }"
      @mouseleave="contextMenu.show = false"
    >
      <button
        v-for="action in contextMenuActions"
        :key="action.key"
        :class="[
          'w-full text-left px-3.5 py-2 transition-colors flex items-center gap-2',
          action.danger
            ? 'text-red-500 hover:bg-red-50'
            : 'text-stone-600 hover:bg-amber-50'
        ]"
        @click="handleContextAction(action.key)"
      >
        <UIcon :name="action.icon" class="w-3.5 h-3.5" />
        {{ action.label }}
      </button>
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
  { to: '/admin/posts',    label: '帖子审核',    icon: 'i-heroicons-photo' },
  { to: '/admin/stores',   label: '门店管理',    icon: 'i-heroicons-building-storefront' },
  { to: '/admin/ai-analysis', label: 'AI 识别记录', icon: 'i-heroicons-sparkles' },
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

<style scoped>
/* Tab 动画 */
.tab-enter-active,
.tab-leave-active {
  transition: all 0.18s ease;
}
.tab-enter-from {
  opacity: 0;
  transform: translateX(-8px) scaleX(0.95);
}
.tab-leave-to {
  opacity: 0;
  transform: scaleX(0.9);
}
.tab-leave-active {
  position: absolute;
}

/* Tab 栏横向滚动隐藏滚动条 */
div:has(> .tab-enter-active) {
  scrollbar-width: none;
}
</style>
