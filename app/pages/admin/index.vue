<template>
  <div class="space-y-5">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <div
        v-for="s in stats" :key="s.label"
        class="bg-white rounded-2xl p-5 border flex items-start justify-between"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div>
          <p class="text-xs text-stone-400 mb-1">{{ s.label }}</p>
          <p class="text-2xl font-bold text-stone-800">{{ s.value }}</p>
        </div>
        <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', s.bg]">
          <UIcon :name="s.icon" :class="['w-5 h-5', s.color]" />
        </div>
      </div>
    </div>

    <!-- 设备状态 + 最新帖子 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- 设备在线列表 -->
      <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
        <div class="flex items-center justify-between px-5 py-3.5 border-b" style="border-color: #f0e6d8">
          <h3 class="text-sm font-semibold text-stone-700">设备在线状态</h3>
          <UBadge :label="`${onlineCount} 在线`" color="green" variant="subtle" size="xs" />
        </div>
        <div class="divide-y" style="divide-color: #faf6f2">
          <div v-if="!recentDevices.length" class="px-5 py-8 text-center text-sm text-stone-400">暂无设备数据</div>
          <div v-for="d in recentDevices" :key="d.mac" class="flex items-center gap-3 px-5 py-2.5">
            <span :class="['w-2 h-2 rounded-full flex-shrink-0', d.online_status ? 'bg-green-400' : 'bg-stone-300']" />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-stone-700 truncate">{{ d.name || d.mac }}</p>
              <p class="text-xs text-stone-400 truncate">{{ d.mac }}</p>
            </div>
            <UBadge :label="d.online_status ? '在线' : '离线'" :color="d.online_status ? 'green' : 'gray'" variant="subtle" size="xs" />
          </div>
        </div>
      </div>

      <!-- 最新帖子 -->
      <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
        <div class="flex items-center justify-between px-5 py-3.5 border-b" style="border-color: #f0e6d8">
          <h3 class="text-sm font-semibold text-stone-700">最新帖子</h3>
          <NuxtLink to="/admin/posts" class="text-xs text-amber-600 hover:text-amber-700">查看全部 →</NuxtLink>
        </div>
        <div class="divide-y" style="divide-color: #faf6f2">
          <div v-if="!recentPosts.length" class="px-5 py-8 text-center text-sm text-stone-400">暂无帖子数据</div>
          <div v-for="p in recentPosts" :key="p.id" class="flex items-start gap-3 px-5 py-2.5">
            <UAvatar :src="p.user_avatar" :alt="p.nickname" size="xs" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-stone-600">{{ p.nickname }}</p>
              <p class="text-xs text-stone-400 truncate mt-0.5">{{ p.content }}</p>
            </div>
            <UBadge
              :label="p.status === 1 ? '正常' : p.status === 2 ? '待审' : '违规'"
              :color="p.status === 1 ? 'green' : p.status === 2 ? 'yellow' : 'red'"
              variant="subtle" size="xs"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminDashboard' })
definePageMeta({ layout: 'admin' })

const stats = ref([
  { label: '总用户数', value: '--', icon: 'i-heroicons-users',              bg: 'bg-blue-50',   color: 'text-blue-500' },
  { label: '在线设备', value: '--', icon: 'i-heroicons-cpu-chip',            bg: 'bg-green-50',  color: 'text-green-500' },
  { label: '今日发帖', value: '--', icon: 'i-heroicons-photo',               bg: 'bg-purple-50', color: 'text-purple-500' },
  { label: '门店数量', value: '--', icon: 'i-heroicons-building-storefront', bg: 'bg-amber-50',  color: 'text-amber-500' },
])
const onlineCount   = ref(0)
const recentDevices = ref<any[]>([])
const recentPosts   = ref<any[]>([])

onMounted(async () => {
  try {
    const d = await $fetch<any>('/api/admin/dashboard')
    stats.value[0].value = d.totalUsers
    stats.value[1].value = d.onlineDevices
    stats.value[2].value = d.todayPosts
    stats.value[3].value = d.totalStores
    onlineCount.value    = d.onlineDevices
    recentDevices.value  = d.recentDevices || []
    recentPosts.value    = d.recentPosts   || []
  } catch {}
})
</script>
