<template>
  <div class="space-y-4">
    <!-- 顶部统计卡片 -->
    <div class="grid grid-cols-4 gap-3">
      <div
        v-for="card in typeCards" :key="card.value"
        class="rounded-2xl p-4 border flex items-center gap-3 cursor-pointer transition-all duration-200"
        :style="activeType === card.value
          ? `background: ${card.activeBg}; border-color: ${card.borderColor}; box-shadow: 0 0 0 2px ${card.borderColor}`
          : 'background: #fff; border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)'"
        @click="setType(card.value)"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          :style="`background: ${card.iconBg}`"
        >
          {{ card.emoji }}
        </div>
        <div class="min-w-0">
          <p class="text-xs text-stone-400 mb-0.5">{{ card.label }}</p>
          <div class="flex items-baseline gap-1.5">
            <p class="text-xl font-bold text-stone-800">{{ card.value === null ? unread.total : (unread as any)[card.unreadKey] }}</p>
            <span class="text-xs text-stone-400">未读</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="bg-white rounded-2xl border px-5 py-3.5 flex items-center gap-3" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <!-- 搜索 -->
      <div class="relative flex-1 max-w-xs">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索关键词 / 用户昵称…"
          class="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition"
          style="border-color: #e2d9d0; focus:ring-color: #f59e0b"
          @keydown.enter="loadData"
        />
      </div>

      <!-- 状态筛选 -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="s in statusOptions" :key="s.value"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
            activeStatus === s.value
              ? 'text-amber-700 font-semibold'
              : 'text-stone-500 hover:text-stone-700 hover:bg-amber-50'
          ]"
          :style="activeStatus === s.value
            ? 'background: #fef3c7; border-color: #fde68a'
            : 'background: transparent; border-color: #e2d9d0'"
          @click="setStatus(s.value)"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <UButton
          icon="i-heroicons-arrow-path"
          color="gray"
          variant="ghost"
          size="sm"
          :loading="loading"
          @click="loadData"
        />
      </div>
    </div>

    <!-- 反馈列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <!-- 表头 -->
      <div class="grid px-5 py-2.5 border-b text-xs font-semibold text-stone-400 uppercase tracking-wide"
        style="grid-template-columns: 100px 1fr 110px 140px 100px 90px 80px; border-color: #f0e6d8; background: #faf8f5">
        <span>类型</span>
        <span>内容</span>
        <span>用户</span>
        <span>手机号</span>
        <span>时间</span>
        <span>状态</span>
        <span class="text-right">操作</span>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="py-16 flex items-center justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-amber-400 animate-spin" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="!list.length" class="py-16 flex flex-col items-center gap-2 text-stone-400">
        <span class="text-3xl">💬</span>
        <p class="text-sm">暂无反馈数据</p>
      </div>

      <!-- 数据行 -->
      <template v-else>
        <div
          v-for="item in list" :key="item.id"
          class="grid items-center px-5 py-3 border-b last:border-0 hover:bg-amber-50/40 transition-colors cursor-pointer group"
          style="grid-template-columns: 100px 1fr 110px 140px 100px 90px 80px; border-color: #f5ede4"
          @click="openDetail(item)"
        >
          <!-- 类型标签 -->
          <div>
            <span
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
              :style="typeStyle(item.type)"
            >
              {{ typeEmoji(item.type) }} {{ typeLabel(item.type) }}
            </span>
          </div>

          <!-- 内容预览 -->
          <div class="min-w-0 pr-4">
            <p class="text-sm text-stone-700 truncate">{{ item.content }}</p>
          </div>

          <!-- 用户 -->
          <div class="flex items-center gap-2 min-w-0">
            <UAvatar :src="item.avatar" :alt="item.nickname" size="xs" class="flex-shrink-0" />
            <p class="text-xs font-medium text-stone-600 truncate">{{ item.nickname || '未命名' }}</p>
          </div>

          <!-- 手机号（点击显示5s完整） -->
          <div class="flex items-center" @click.stop>
            <button
              class="text-xs font-mono px-2 py-1 rounded-lg transition-all duration-200 select-all"
              :class="revealedPhones.has(item.id)
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'"
              :title="revealedPhones.has(item.id) ? '5秒后自动隐藏' : '点击查看完整号码'"
              @click="revealPhone(item)"
            >
              {{ revealedPhones.has(item.id) ? item.phone : maskPhone(item.phone) }}
            </button>
          </div>

          <!-- 时间 -->
          <p class="text-xs text-stone-400">{{ formatDate(item.created_at) }}</p>

          <!-- 状态 -->
          <UBadge
            :label="statusLabel(item.status)"
            :color="statusColor(item.status)"
            variant="subtle"
            size="sm"
            class="font-semibold"
          />

          <!-- 操作 -->
          <div class="flex items-center justify-end gap-1" @click.stop>
            <UButton
              v-if="item.status === 0"
              icon="i-heroicons-eye"
              color="gray"
              variant="ghost"
              size="xs"
              title="标记已读"
              @click="updateStatus(item, 1)"
            />
            <UButton
              v-if="item.status < 2"
              icon="i-heroicons-check-circle"
              color="green"
              variant="ghost"
              size="xs"
              title="标记已处理"
              @click="updateStatus(item, 2)"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="flex items-center justify-between px-1">
      <p class="text-xs text-stone-400">共 {{ total }} 条反馈</p>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-heroicons-chevron-left"
          color="gray"
          variant="ghost"
          size="xs"
          :disabled="page <= 1"
          @click="page--; loadData()"
        />
        <span class="text-xs text-stone-500 px-2">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
        <UButton
          icon="i-heroicons-chevron-right"
          color="gray"
          variant="ghost"
          size="xs"
          :disabled="page >= Math.ceil(total / pageSize)"
          @click="page++; loadData()"
        />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="detail" class="fixed inset-0 z-50 flex" @click.self="detail = null">
          <!-- 背景蒙层 -->
          <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="detail = null" />
          <!-- 抽屉 -->
          <div class="absolute right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl flex flex-col" style="border-left: 1px solid #f0e6d8">
            <!-- 抽屉头部 -->
            <div class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style="border-color: #f0e6d8">
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
                  :style="typeStyle(detail.type)"
                >
                  {{ typeEmoji(detail.type) }} {{ typeLabel(detail.type) }}
                </span>
                <UBadge :label="statusLabel(detail.status)" :color="statusColor(detail.status)" variant="subtle" />
              </div>
              <button class="text-stone-400 hover:text-stone-600 transition-colors" @click="detail = null">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- 内容区 -->
            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <!-- 标题 -->
              <div>
                <p class="text-xs text-stone-400 mb-1">标题</p>
                <p class="text-base font-semibold text-stone-800">{{ detail.title }}</p>
              </div>

              <!-- 内容 -->
              <div>
                <p class="text-xs text-stone-400 mb-2">反馈内容</p>
                <div class="rounded-xl p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap" style="background: #faf8f5; border: 1px solid #f0e6d8">
                  {{ detail.content }}
                </div>
              </div>

              <!-- 用户信息 -->
              <div>
                <p class="text-xs text-stone-400 mb-2">提交用户</p>
                <div class="flex items-center gap-3 p-3 rounded-xl" style="background: #faf8f5; border: 1px solid #f0e6d8">
                  <UAvatar :src="detail.avatar" :alt="detail.nickname" size="md" />
                  <div>
                    <p class="text-sm font-semibold text-stone-700">{{ detail.nickname || '未命名' }}</p>
                    <p class="text-xs text-stone-400 mt-0.5">{{ maskPhone(detail.phone) }}</p>
                    <p class="text-xs text-stone-400">用户ID：{{ detail.user_id }}</p>
                  </div>
                </div>
              </div>

              <!-- 提交时间 -->
              <div>
                <p class="text-xs text-stone-400 mb-1">提交时间</p>
                <p class="text-sm text-stone-600">{{ formatDateFull(detail.created_at) }}</p>
              </div>
            </div>

            <!-- 底部操作 -->
            <div class="px-6 py-4 border-t flex items-center gap-3 flex-shrink-0" style="border-color: #f0e6d8">
              <UButton
                v-if="detail.status === 0"
                icon="i-heroicons-eye"
                label="标记已读"
                color="gray"
                variant="outline"
                size="sm"
                @click="updateStatus(detail, 1)"
              />
              <UButton
                v-if="detail.status < 2"
                icon="i-heroicons-check-circle"
                label="标记已处理"
                color="green"
                variant="soft"
                size="sm"
                @click="updateStatus(detail, 2)"
              />
              <UButton
                v-if="detail.status > 0"
                icon="i-heroicons-arrow-uturn-left"
                label="恢复未读"
                color="gray"
                variant="ghost"
                size="sm"
                @click="updateStatus(detail, 0)"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminFeedback' })
definePageMeta({ layout: 'admin' })

// ── 状态 ──────────────────────────────────────────
const loading   = ref(false)
const list      = ref<any[]>([])
const total     = ref(0)
const page      = ref(1)
const pageSize  = ref(20)
const keyword   = ref('')

// 记录已展开完整手机号的行 id（5s 后自动隐藏）
const revealedPhones = ref<Set<number>>(new Set())
const activeType   = ref<number | null>(null)
const activeStatus = ref<number | null>(null)
const detail    = ref<any>(null)
const unread    = ref({ total: 0, suggestion: 0, complaint: 0, praise: 0 })

// ── 类型卡片 ──────────────────────────────────────
const typeCards = [
  { value: null,  label: '全部反馈', emoji: '📋', unreadKey: 'total',      iconBg: '#fef3c7', activeBg: '#fef9ee', borderColor: '#fbbf24' },
  { value: 1,     label: '建议',     emoji: '💡', unreadKey: 'suggestion', iconBg: '#eff6ff', activeBg: '#eff6ff', borderColor: '#60a5fa' },
  { value: 2,     label: '投诉',     emoji: '😤', unreadKey: 'complaint',  iconBg: '#fff1f2', activeBg: '#fff1f2', borderColor: '#fb7185' },
  { value: 3,     label: '好评',     emoji: '⭐', unreadKey: 'praise',     iconBg: '#f0fdf4', activeBg: '#f0fdf4', borderColor: '#4ade80' },
]

// ── 状态过滤按钮 ───────────────────────────────────
const statusOptions = [
  { value: null, label: '全部' },
  { value: 0,    label: '未读' },
  { value: 1,    label: '已读' },
  { value: 2,    label: '已处理' },
]

// ── 工具函数 ──────────────────────────────────────
function typeLabel(type: number) {
  return { 1: '建议', 2: '投诉', 3: '好评' }[type] ?? '未知'
}
function typeEmoji(type: number) {
  return { 1: '💡', 2: '😤', 3: '⭐' }[type] ?? '📋'
}
function typeStyle(type: number) {
  const styles: Record<number, string> = {
    1: 'background: #eff6ff; color: #1d4ed8;',
    2: 'background: #fff1f2; color: #e11d48;',
    3: 'background: #f0fdf4; color: #15803d;',
  }
  return styles[type] ?? 'background: #f5f5f5; color: #6b7280;'
}
function statusLabel(status: number) {
  return { 0: '未读', 1: '已读', 2: '已处理' }[status] ?? '未知'
}
function statusColor(status: number): any {
  return { 0: 'red', 1: 'gray', 2: 'green' }[status] ?? 'gray'
}
function maskPhone(phone: string) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
const phoneTimers = new Map<number, ReturnType<typeof setTimeout>>()
function revealPhone(item: any) {
  const id = item.id
  // 若已展开则直接重置计时
  if (phoneTimers.has(id)) clearTimeout(phoneTimers.get(id)!)
  revealedPhones.value = new Set([...revealedPhones.value, id])
  const t = setTimeout(() => {
    revealedPhones.value = new Set([...revealedPhones.value].filter(i => i !== id))
    phoneTimers.delete(id)
  }, 5000)
  phoneTimers.set(id, t)
}
function formatDate(dt: string) {
  if (!dt) return '—'
  const d = new Date(dt)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000)   return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function formatDateFull(dt: string) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── 数据加载 ──────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (activeType.value !== null)   params.type    = activeType.value
    if (activeStatus.value !== null) params.status  = activeStatus.value
    if (keyword.value)               params.keyword = keyword.value

    const data = await $fetch<any>('/api/admin/feedback', { params })
    list.value   = data.list
    total.value  = data.total
    unread.value = data.unread
  } catch (e: any) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── 筛选交互 ──────────────────────────────────────
function setType(val: number | null) {
  activeType.value = activeType.value === val ? null : val
  page.value = 1
  loadData()
}
function setStatus(val: number | null) {
  activeStatus.value = activeStatus.value === val ? null : val
  page.value = 1
  loadData()
}

// ── 详情 ──────────────────────────────────────────
function openDetail(item: any) {
  detail.value = { ...item }
  // 自动标记已读
  if (item.status === 0) updateStatus(item, 1)
}

// ── 状态更新 ──────────────────────────────────────
async function updateStatus(item: any, status: number) {
  try {
    await $fetch(`/api/admin/feedback/${item.id}`, { method: 'PUT', body: { status } })
    item.status = status
    if (detail.value?.id === item.id) detail.value.status = status
    // 更新未读计数
    await loadData()
  } catch (e: any) {
    console.error(e)
  }
}

onMounted(loadData)
</script>

<style scoped>
/* 抽屉动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-active > div:last-child,
.drawer-leave-active > div:last-child {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-enter-from > div:last-child,
.drawer-leave-to > div:last-child {
  transform: translateX(100%);
}
</style>
