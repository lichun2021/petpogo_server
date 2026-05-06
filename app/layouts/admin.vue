<template>
  <div class="flex h-screen overflow-hidden" style="background: #faf8f5">
    <!-- 侧边栏 -->
    <aside class="w-56 flex-shrink-0 flex flex-col border-r" style="background: #fff8f0; border-color: #f0e6d8">
      <!-- Logo -->
      <div class="h-14 flex items-center gap-3 px-4 border-b" style="border-color: #f0e6d8">
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
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            isActive(item.to)
              ? 'text-amber-700 font-semibold'
              : 'text-stone-500 hover:text-stone-700 hover:bg-amber-50'
          ]"
          :style="isActive(item.to) ? 'background: #fef3c7; border: 1px solid #fde68a' : 'border: 1px solid transparent'"
        >
          <UIcon :name="item.icon" class="w-4 h-4 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部 -->
      <div class="p-3 border-t" style="border-color: #f0e6d8">
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
      <!-- 顶栏 -->
      <header class="h-14 flex items-center justify-between px-5 border-b bg-white flex-shrink-0" style="border-color: #f0e6d8">
        <h1 class="text-sm font-semibold text-stone-700">{{ currentTitle }}</h1>
      </header>

      <!-- 页面内容 -->
      <main class="flex-1 overflow-y-auto p-5" style="background: #faf8f5">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const nav = [
  { to: '/admin',         label: '数据概览', icon: 'i-heroicons-squares-2x2' },
  { to: '/admin/users',   label: '用户管理', icon: 'i-heroicons-users' },
  { to: '/admin/devices', label: '设备管理', icon: 'i-heroicons-cpu-chip' },
  { to: '/admin/posts',   label: '帖子审核', icon: 'i-heroicons-photo' },
  { to: '/admin/stores',  label: '门店管理', icon: 'i-heroicons-building-storefront' },
]

const titleMap: Record<string, string> = {
  '/admin':         '数据概览',
  '/admin/users':   '用户管理',
  '/admin/devices': '设备管理',
  '/admin/posts':   '帖子审核',
  '/admin/stores':  '门店管理',
}

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path.startsWith(to)
}

const currentTitle = computed(() => {
  for (const [path, title] of Object.entries(titleMap)) {
    if (path !== '/admin' && route.path.startsWith(path)) return title
  }
  return titleMap[route.path] || '管理后台'
})

function logout() {
  localStorage.removeItem('admin_token')
  navigateTo('/admin/login')
}
</script>
