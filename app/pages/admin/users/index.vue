<template>
  <div class="space-y-4">
    <!-- 搜索栏 -->
    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="search" placeholder="搜索手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 人`" color="amber" variant="subtle" size="xs" class="ml-auto" />
    </div>

    <!-- 状态筛选 Tab 条 -->
    <div class="flex gap-2">
      <button
        v-for="(tab, i) in tabs" :key="tab.key"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
          activeTab === i
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #f0e6d8"
        @click="activeTab = i; page = 1; loadList()"
      >{{ tab.label }}</button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4 w-10"></th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">用户信息</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">注册时间</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">操作</th>
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
              <p class="text-xs text-stone-400">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '正常' : '禁用'" :color="row.status === 1 ? 'green' : 'red'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-400">{{ formatDate(row.created_at) }}</td>
            <td class="py-3 px-4">
              <UButton
                :label="row.status === 1 ? '禁用' : '启用'"
                :color="row.status === 1 ? 'red' : 'green'"
                variant="subtle" size="xs"
                :loading="row._loading"
                @click="toggleStatus(row)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
      </div>
    </div>
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

const activeTab = ref(0)
const search    = ref('')
const page      = ref(1)
const pageSize  = 20
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(false)

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
    toast.add({ title: '操作成功', color: 'green' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { row._loading = false }
}

function formatDate(s: string) { return s ? new Date(s).toLocaleDateString('zh-CN') : '-' }
onMounted(loadList)
</script>
