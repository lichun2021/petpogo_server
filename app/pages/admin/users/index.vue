<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-stone-900">用户管理</h1>
    <!-- 搜索栏 -->
    <div class="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-3" style="border-color: #e7e5e4">
      <UInput v-model="search" placeholder="搜索手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="w-full sm:max-w-sm" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="primary" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="neutral" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 人`" color="primary" variant="subtle" size="xs" class="ml-auto" />
    </div>

    <!-- 状态筛选 Tab -->
    <div class="admin-segment" aria-label="状态筛选">
      <button
        v-for="(tab, i) in tabs" :key="tab.key"
        :aria-pressed="activeTab === i"
        @click="activeTab = i; page = 1; loadList()"
      >{{ tab.label }}</button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-500">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-stone-50 border-b border-stone-200">
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4 w-10"></th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">用户信息</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">计划</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">积分</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">注册时间</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in list" :key="row.id"
            class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors"
          >
            <td class="py-3 px-4">
              <UAvatar :src="row.avatar" :alt="row.nickname || row.phone" size="sm" />
            </td>
            <td class="py-3 px-4">
              <p class="text-stone-800 font-medium">{{ row.nickname || '未设置' }}</p>
              <p class="text-xs text-stone-500">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4">
              <UBadge
                :label="planLabel(row.plan_type)"
                :color="row.plan_type === 2 ? 'secondary' : row.plan_type === 1 ? 'primary' : 'neutral'"
                variant="subtle" size="xs"
              />
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1.5">
                <span class="text-stone-800 font-semibold text-sm">{{ row.points_total }}</span>
                <span class="text-xs text-stone-500">分</span>
              </div>
              <div class="flex gap-2 mt-0.5">
                <span class="text-xs text-amber-500">期 {{ row.points_expiring }}</span>
                <span class="text-xs text-stone-500">永 {{ row.points_permanent }}</span>
              </div>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '正常' : '禁用'" :color="row.status === 1 ? 'success' : 'error'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ formatDate(row.created_at) }}</td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <UButton
                  label="流水"
                  color="primary"
                  variant="ghost"
                  size="xs"
                  icon="i-heroicons-receipt-refund"
                  @click="openLog(row)"
                />
                <UButton
                  :label="row.status === 1 ? '禁用' : '启用'"
                  :color="row.status === 1 ? 'error' : 'success'"
                  variant="subtle" size="xs"
                  :loading="row._loading"
                  @click="toggleStatus(row)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" @update:page="loadList" />
      </div>
    </div>

    <!-- 积分流水侧边栏 -->
    <USlideover v-model:open="showLog" title="积分流水" description="查看用户积分变动记录" side="right" :ui="{ content: 'max-w-xl' }">
      <template #content>
      <div class="flex flex-col h-full min-h-0">
        <!-- 侧边栏头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <p class="text-sm font-semibold text-stone-800">积分流水</p>
            <p class="text-xs text-stone-500 mt-0.5">{{ logUser?.nickname || logUser?.phone }}</p>
          </div>
          <!-- 积分总览 -->
          <div class="flex items-center gap-3 mr-4">
            <div class="text-center">
              <p class="text-xs text-stone-500">有期限</p>
              <p class="text-sm font-bold text-amber-500">{{ logUser?.points_expiring ?? 0 }}</p>
            </div>
            <div class="w-px h-8 bg-stone-100" />
            <div class="text-center">
              <p class="text-xs text-stone-500">永久积分</p>
              <p class="text-sm font-bold text-stone-700">{{ logUser?.points_permanent ?? 0 }}</p>
            </div>
            <div class="w-px h-8 bg-stone-100" />
            <div class="text-center">
              <p class="text-xs text-stone-500">合计</p>
              <p class="text-sm font-bold text-green-600">{{ logUser?.points_total ?? 0 }}</p>
            </div>
          </div>
          <UButton icon="i-heroicons-x-mark" aria-label="关闭" color="neutral" variant="ghost" size="sm" @click="showLog = false" />
        </div>

        <!-- 方向筛选 -->
        <div class="flex gap-2 px-5 pt-3 pb-2">
          <button
            v-for="f in logFilters" :key="f.value"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-medium transition-all',
              logDirection === f.value
                ? 'bg-amber-500 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-amber-50'
            ]"
            @click="logDirection = f.value; logPage = 1; loadLog()"
          >{{ f.label }}</button>
        </div>

        <!-- 流水列表 -->
        <div class="flex-1 overflow-y-auto px-5 pb-4">
          <div v-if="logLoading" class="flex justify-center py-10">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" />
          </div>
          <div v-else-if="!logList.length" class="py-10 text-center text-sm text-stone-500">暂无记录</div>
          <div v-else class="space-y-2 mt-1">
            <div
              v-for="row in logList" :key="row.id"
              class="flex items-start gap-3 p-3 rounded-xl border transition-colors"
              :class="row.direction === 1 ? 'border-green-100 bg-green-50/40' : 'border-amber-100 bg-amber-50/30'"
            >
              <!-- 图标 -->
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                :class="row.direction === 1 ? 'bg-green-100' : 'bg-amber-100'"
              >
                <UIcon
                  :name="row.direction === 1 ? 'i-heroicons-arrow-down-left' : 'i-heroicons-arrow-up-right'"
                  class="w-3.5 h-3.5"
                  :class="row.direction === 1 ? 'text-green-600' : 'text-amber-600'"
                />
              </div>
              <!-- 内容 -->
              <div class="flex-1 min-w-0">
                <p class="text-xs text-stone-700 font-medium leading-snug">{{ row.reason }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                    {{ row.type_code || (row.points_type === 1 ? '周积分' : '永久积分') }}
                  </span>
                  <span class="text-xs text-stone-500">余 {{ row.balance_after }}</span>
                  <span class="text-xs text-stone-300">{{ formatTime(row.created_at) }}</span>
                </div>
              </div>
              <!-- 金额 -->
              <div class="text-sm font-bold flex-shrink-0" :class="row.direction === 1 ? 'text-green-600' : 'text-amber-600'">
                {{ row.direction === 1 ? '+' : '-' }}{{ row.amount }}
              </div>
            </div>
          </div>

          <!-- 加载更多 -->
          <div v-if="logList.length < logTotal" class="pt-3 flex justify-center">
            <UButton
              label="加载更多"
              color="neutral" variant="outline" size="xs"
              :loading="logLoading"
              @click="loadMoreLog"
            />
          </div>
        </div>
      </div>
          </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminUsersList' })
definePageMeta({ layout: 'admin' })

const tabs = [
  { label: '全部用户', key: '' },
  { label: '正常',     key: '1' },
  { label: '禁用',     key: '2' },
]
const logFilters = [
  { label: '全部', value: '' },
  { label: '获得', value: '1' },
  { label: '消耗', value: '2' },
]

const activeTab = ref(0)
const search    = ref('')
const page      = ref(1)
const pageSize  = 20
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(false)

// 侧边栏状态
const showLog     = ref(false)
const logUser     = ref<any>(null)
const logList     = ref<any[]>([])
const logTotal    = ref(0)
const logPage     = ref(1)
const logLoading  = ref(false)
const logDirection = ref('')
const logPageSize  = 30

function planLabel(t: number) {
  return { 0: 'Free', 1: 'Pro', 2: 'ProMax' }[t] ?? 'Free'
}

async function loadList() {
  loading.value = true
  try {
    const statusVal = tabs[activeTab.value]?.key || ''
    const d = await $fetch<any>('/api/admin/users', {
      query: { page: page.value, size: pageSize, search: search.value, status: statusVal }
    })
    list.value  = d.list
    total.value = d.total
  } finally { loading.value = false }
}

function reset() { search.value = ''; activeTab.value = 0; page.value = 1; loadList() }

const toast = useToast()
async function toggleStatus(row: any) {
  row._loading = true
  try {
    await $fetch(`/api/admin/users/${row.id}/status`, { method: 'PUT', body: { status: row.status === 1 ? 2 : 1 } })
    row.status = row.status === 1 ? 2 : 1
    toast.add({ title: '操作成功', color: 'success' })
  } catch { toast.add({ title: '操作失败', color: 'error' }) }
  finally { row._loading = false }
}

// 打开积分流水侧边栏
function openLog(row: any) {
  logUser.value     = row
  logList.value     = []
  logTotal.value    = 0
  logPage.value     = 1
  logDirection.value = ''
  showLog.value     = true
  loadLog()
}

async function loadLog() {
  if (!logUser.value) return
  logLoading.value = true
  try {
    const d = await $fetch<any>('/api/admin/points/logs', {
      query: {
        userId:    logUser.value.id,
        direction: logDirection.value,
        page:      logPage.value,
        limit:     logPageSize,
      }
    })
    logList.value  = d.list
    logTotal.value = d.total
  } finally { logLoading.value = false }
}

async function loadMoreLog() {
  if (!logUser.value) return
  logLoading.value = true
  try {
    const d = await $fetch<any>('/api/admin/points/logs', {
      query: {
        userId:    logUser.value.id,
        direction: logDirection.value,
        page:      logPage.value + 1,
        limit:     logPageSize,
      }
    })
    logList.value.push(...d.list)
    logPage.value++
  } finally { logLoading.value = false }
}

function formatDate(s: string) { return s ? new Date(s).toLocaleDateString('zh-CN') : '-' }
function formatTime(s: string) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(loadList)
</script>
