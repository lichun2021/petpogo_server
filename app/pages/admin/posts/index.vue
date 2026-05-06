<template>
  <div class="space-y-4">
    <!-- 待审提示 -->
    <div v-if="pendingCount > 0"
      class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
      <UIcon name="i-heroicons-clock" class="w-4 h-4 flex-shrink-0" />
      <span>有 <strong>{{ pendingCount }}</strong> 条帖子待审核</span>
    </div>

    <!-- 页签 -->
    <UTabs v-model="activeTab" :items="tabs" color="amber" @update:model-value="onTabChange">
      <template #content="{ item }">
        <div class="pt-3 space-y-3">
          <!-- 类型过滤 + 总数 -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-stone-400">类型：</span>
            <UButton
              v-for="t in typeOpts" :key="t.value"
              :label="t.label"
              size="xs"
              :color="mediaType === t.value ? 'amber' : 'gray'"
              :variant="mediaType === t.value ? 'solid' : 'outline'"
              @click="mediaType = t.value; page = 1; loadList()"
            />
            <span class="ml-auto text-xs text-stone-400">共 {{ total }} 条</span>
          </div>

          <!-- 帖子网格 -->
          <div v-if="loading" class="flex justify-center py-10">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
          </div>
          <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div
              v-for="p in list" :key="p.id"
              class="bg-white rounded-xl border p-4 hover:border-amber-200 transition-colors"
              style="border-color: #f0e6d8"
            >
              <!-- 用户信息 -->
              <div class="flex items-center gap-2 mb-2">
                <UAvatar :src="p.user_avatar" :alt="p.nickname" size="xs" />
                <span class="text-xs text-stone-600 font-medium">{{ p.nickname }}</span>
                <UBadge
                  :label="p.media_type === 0 ? '文字' : p.media_type === 1 ? '图片' : '视频'"
                  :color="p.media_type === 0 ? 'gray' : p.media_type === 1 ? 'blue' : 'purple'"
                  variant="subtle" size="xs" class="ml-auto"
                />
              </div>
              <!-- 内容 -->
              <p class="text-sm text-stone-600 line-clamp-2 mb-2">{{ p.content || '（无文字）' }}</p>
              <!-- 图片预览 -->
              <div v-if="p.media_urls?.length" class="grid grid-cols-3 gap-1 mb-3 rounded-lg overflow-hidden">
                <img v-for="(url, i) in p.media_urls.slice(0, 3)" :key="i" :src="url" class="w-full aspect-square object-cover" />
              </div>
              <!-- 状态 + 操作 -->
              <div class="flex items-center justify-between pt-2 border-t border-stone-100">
                <div class="flex items-center gap-2">
                  <UBadge
                    :label="p.status === 1 ? '已通过' : p.status === 2 ? '待审核' : '已违规'"
                    :color="p.status === 1 ? 'green' : p.status === 2 ? 'yellow' : 'red'"
                    variant="subtle" size="xs"
                  />
                  <span class="text-xs text-stone-400">{{ formatDate(p.created_at) }}</span>
                </div>
                <div class="flex gap-1">
                  <UButton v-if="p.status !== 1" label="通过" color="green" variant="subtle" size="xs" :loading="p._loading" @click="updateStatus(p, 1)" />
                  <UButton v-if="p.status !== 3" label="违规" color="red"   variant="subtle" size="xs" :loading="p._loading" @click="updateStatus(p, 3)" />
                </div>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div v-if="total > pageSize" class="flex justify-center pt-2">
            <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const tabs = [
  { label: '待审核', key: '2' },
  { label: '已通过', key: '1' },
  { label: '已违规', key: '3' },
  { label: '全部',   key: ''  },
]

const typeOpts = [
  { label: '全部', value: '' },
  { label: '图片', value: '1' },
  { label: '视频', value: '2' },
  { label: '文字', value: '0' },
]

const activeTab    = ref(0)
const mediaType    = ref('')
const page         = ref(1)
const pageSize     = 12
const list         = ref<any[]>([])
const total        = ref(0)
const pendingCount = ref(0)
const loading      = ref(false)

function onTabChange() { page.value = 1; mediaType.value = ''; loadList() }

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/posts', {
      query: { page: page.value, size: pageSize, status: tabs[activeTab.value]?.key, mediaType: mediaType.value }
    })
    list.value         = d.list
    total.value        = d.total
    pendingCount.value = d.pendingCount ?? pendingCount.value
  } finally { loading.value = false }
}

const toast = useToast()
async function updateStatus(p: any, status: number) {
  p._loading = true
  try {
    await $fetch(`/api/admin/posts/${p.id}/status`, { method: 'PUT', body: { status } })
    p.status = status
    if (status === 1) pendingCount.value = Math.max(0, pendingCount.value - 1)
    toast.add({ title: status === 1 ? '已通过' : '已标记违规', color: status === 1 ? 'green' : 'red' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { p._loading = false }
}

function formatDate(s: string) { return s ? new Date(s).toLocaleDateString('zh-CN') : '' }
onMounted(loadList)
</script>
