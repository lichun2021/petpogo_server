<template>
  <div class="space-y-4">
    <!-- 待审提示 -->
    <div v-if="pendingCount > 0"
      class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
      <UIcon name="i-heroicons-clock" class="w-4 h-4 flex-shrink-0" />
      <span>有 <strong>{{ pendingCount }}</strong> 条帖子待审核</span>
    </div>

    <!-- 筛选条 -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="(tab, i) in tabs" :key="tab.key"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
          activeTab === i ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #f0e6d8"
        @click="activeTab = i; page = 1; mediaType = ''; loadList()"
      >{{ tab.label }}</button>

      <span class="text-stone-300">|</span>

      <button
        v-for="t in typeOpts" :key="t.value"
        :class="[
          'px-3 py-1 rounded-full text-xs font-medium transition-all',
          mediaType === t.value ? 'bg-stone-700 text-white' : 'bg-white border text-stone-400 hover:text-stone-600'
        ]"
        style="border-color: #f0e6d8"
        @click="mediaType = t.value; page = 1; loadList()"
      >{{ t.label }}</button>

      <span class="text-stone-300">|</span>

      <!-- 标签筛选 -->
      <button
        v-for="tg in tagOpts" :key="tg.value"
        :class="[
          'px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1',
          activeTag === tg.value
            ? `${tg.activeCls} text-white`
            : 'bg-white border text-stone-400 hover:text-stone-600'
        ]"
        style="border-color: #f0e6d8"
        @click="activeTag = tg.value; page = 1; loadList()"
      >
        <span>{{ tg.emoji }}</span>{{ tg.label }}
      </button>

      <span class="ml-auto text-xs text-stone-400">共 {{ total }} 条</span>
    </div>

    <!-- 列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>

      <div v-else>
        <!-- 表头 -->
        <div class="grid grid-cols-[80px_1fr_120px_80px_100px_140px] gap-3 px-4 py-2 bg-amber-50/50 border-b border-orange-100 text-xs text-stone-500 font-medium">
          <span>封面</span>
          <span>内容</span>
          <span>用户</span>
          <span>标签</span>
          <span>状态</span>
          <span>操作</span>
        </div>

        <!-- 行 -->
        <div
          v-for="p in list" :key="p.id"
          class="grid grid-cols-[80px_1fr_120px_80px_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-amber-50/20 transition-colors items-center cursor-pointer"
          @click="openTab(`/admin/posts/${p.id}`)"
        >
          <!-- 封面 -->
          <div class="w-16 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 relative">
            <img
              v-if="getCover(p)"
              :src="getCover(p)"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <UIcon
                :name="p.media_type === 2 ? 'i-heroicons-video-camera' : 'i-heroicons-photo'"
                class="w-5 h-5 text-stone-300"
              />
            </div>
            <!-- 视频标记 -->
            <div v-if="p.media_type === 2" class="absolute bottom-0 left-0 right-0 bg-black/40 flex items-center justify-center py-0.5">
              <UIcon name="i-heroicons-play-solid" class="w-3 h-3 text-white" />
            </div>
          </div>

          <!-- 内容 -->
          <div class="min-w-0">
            <p class="text-sm text-stone-700 line-clamp-1 font-medium">{{ p.content || '（无文字）' }}</p>
            <p class="text-xs text-stone-400 mt-0.5">{{ formatDate(p.created_at) }}</p>
            <div v-if="p.reject_reason" class="mt-1 text-xs text-red-400 flex items-center gap-1">
              <UIcon name="i-heroicons-exclamation-circle" class="w-3 h-3" />
              {{ p.reject_reason }}
            </div>
          </div>

          <!-- 用户 -->
          <div class="flex items-center gap-1.5 min-w-0">
            <UAvatar :src="p.user_avatar" :alt="p.nickname" size="xs" />
            <span class="text-xs text-stone-600 truncate">{{ p.nickname }}</span>
          </div>

          <!-- 标签 -->
          <div @click.stop>
            <span
              :class="tagBadgeCls(p.tag)"
              class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
              @click="openTagModal(p)"
            >
              {{ tagEmoji(p.tag) }}{{ tagLabel(p.tag) }}
            </span>
          </div>

          <!-- 状态 -->
          <div>
            <UBadge
              :label="statusLabel[p.status] || '-'"
              :color="statusColor[p.status] || 'gray'"
              variant="subtle" size="xs"
            />
          </div>

          <!-- 操作 -->
          <div class="flex gap-1.5" @click.stop>
            <UButton
              v-if="p.status !== 1 && p.status !== 0"
              label="通过" color="green" variant="subtle" size="xs"
              :loading="p._loading"
              @click="approvePost(p)"
            />
            <UButton
              v-if="p.status !== 3 && p.status !== 0"
              label="违规" color="red" variant="subtle" size="xs"
              :loading="p._loading"
              @click="openReject(p)"
            />
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
      </div>
    </div>

    <!-- 拒绝理由弹窗 -->
    <div v-if="rejectModal.show"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.4)"
      @click.self="rejectModal.show = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-80 p-5">
        <h3 class="font-semibold text-stone-800 mb-1">标记违规</h3>
        <p class="text-xs text-stone-400 mb-4">请选择违规原因（必填）</p>

        <div class="space-y-2 mb-4">
          <label
            v-for="r in rejectReasons" :key="r"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all',
              rejectModal.reason === r
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-stone-200 text-stone-600 hover:border-stone-300'
            ]"
          >
            <input type="radio" v-model="rejectModal.reason" :value="r" class="accent-red-500" />
            <span class="text-sm">{{ r }}</span>
          </label>
        </div>

        <div class="flex gap-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="rejectModal.show = false" />
          <UButton
            label="确认违规"
            color="red"
            class="flex-1"
            :disabled="!rejectModal.reason"
            :loading="rejectModal.loading"
            @click="confirmReject"
          />
        </div>
      </div>
    </div>

    <!-- 标签修改弹窗 -->
    <div v-if="tagModal.show"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.4)"
      @click.self="tagModal.show = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-72 p-5">
        <h3 class="font-semibold text-stone-800 mb-1">修改帖子标签</h3>
        <p class="text-xs text-stone-400 mb-4">为帖子选择合适的分类标签</p>

        <div class="space-y-2 mb-5">
          <label
            v-for="tg in tagOpts.filter(t => t.value !== '')" :key="tg.value"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all',
              tagModal.tag === tg.value
                ? 'border-amber-300 bg-amber-50'
                : 'border-stone-200 hover:border-stone-300'
            ]"
          >
            <input type="radio" v-model="tagModal.tag" :value="tg.value" class="accent-amber-500" />
            <span class="text-lg">{{ tg.emoji }}</span>
            <span class="text-sm font-medium text-stone-700">{{ tg.label }}</span>
          </label>
        </div>

        <div class="flex gap-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="tagModal.show = false" />
          <UButton
            label="保存"
            color="amber"
            class="flex-1"
            :loading="tagModal.loading"
            @click="confirmTag"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPostsList' })
definePageMeta({ layout: 'admin' })

const tabs = [
  { label: '全部',   key: ''  },
  { label: '待审核', key: '2' },
  { label: '已通过', key: '1' },
  { label: '已违规', key: '3' },
  { label: '转码中', key: '0' },
]

const typeOpts = [
  { label: '全部', value: '' },
  { label: '图片', value: '1' },
  { label: '视频', value: '2' },
  { label: '文字', value: '0' },
]

const tagOpts = [
  { label: '全部', value: '',      emoji: '📋', activeCls: 'bg-stone-500' },
  { label: '猫',   value: 'cat',   emoji: '🐱', activeCls: 'bg-orange-400' },
  { label: '狗',   value: 'dog',   emoji: '🐶', activeCls: 'bg-amber-500'  },
  { label: '其他', value: 'other', emoji: '🐾', activeCls: 'bg-stone-400'  },
]

const statusLabel: Record<number, string> = { 0: '转码中', 1: '已通过', 2: '待审核', 3: '已违规' }
const statusColor: Record<number, string> = { 0: 'gray',   1: 'green',  2: 'yellow', 3: 'red'   }

const rejectReasons = ['内容违规', '版权问题', '违规广告', '涉嫌诈骗', '色情低俗', '虚假信息', '其他']

const { openTab } = useTabStore()

const activeTab    = ref(0)
const mediaType    = ref('')
const activeTag    = ref('')
const page         = ref(1)
const pageSize     = 20
const list         = ref<any[]>([])
const total        = ref(0)
const pendingCount = ref(0)
const loading      = ref(false)

const rejectModal = reactive({
  show:    false,
  post:    null as any,
  reason:  '',
  loading: false,
})

const tagModal = reactive({
  show:    false,
  post:    null as any,
  tag:     'other',
  loading: false,
})

// 标签展示辅助
function tagLabel(tag: string) {
  return ({ cat: '猫', dog: '狗', other: '其他' } as any)[tag] ?? '其他'
}
function tagEmoji(tag: string) {
  return ({ cat: '🐱', dog: '🐶', other: '🐾' } as any)[tag] ?? '🐾'
}
function tagBadgeCls(tag: string) {
  return ({
    cat:   'bg-orange-100 text-orange-600',
    dog:   'bg-amber-100  text-amber-600',
    other: 'bg-stone-100  text-stone-500',
  } as any)[tag] ?? 'bg-stone-100 text-stone-500'
}

function getCover(p: any): string {
  if (p.cover_url) return p.cover_url
  if (p.media_urls?.length) return p.media_urls[0]
  return ''
}

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/posts', {
      query: {
        page: page.value,
        size: pageSize,
        status: tabs[activeTab.value]?.key,
        mediaType: mediaType.value,
        tag: activeTag.value,
      }
    })
    list.value         = d.list
    total.value        = d.total
    pendingCount.value = d.pendingCount ?? pendingCount.value
  } finally { loading.value = false }
}

const toast = useToast()

async function approvePost(p: any) {
  p._loading = true
  try {
    await $fetch(`/api/admin/posts/${p.id}/status`, { method: 'PUT', body: { status: 1 } })
    p.status = 1
    pendingCount.value = Math.max(0, pendingCount.value - 1)
    toast.add({ title: '已通过审核', color: 'green' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { p._loading = false }
}

function openReject(p: any) {
  rejectModal.post   = p
  rejectModal.reason = ''
  rejectModal.show   = true
}

async function confirmReject() {
  if (!rejectModal.reason) return
  rejectModal.loading = true
  try {
    await $fetch(`/api/admin/posts/${rejectModal.post.id}/status`, {
      method: 'PUT',
      body:   { status: 3, reject_reason: rejectModal.reason }
    })
    rejectModal.post.status        = 3
    rejectModal.post.reject_reason = rejectModal.reason
    rejectModal.show               = false
    toast.add({ title: `已标记违规：${rejectModal.reason}`, color: 'red' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { rejectModal.loading = false }
}

function openTagModal(p: any) {
  tagModal.post = p
  tagModal.tag  = p.tag || 'other'
  tagModal.show = true
}

async function confirmTag() {
  tagModal.loading = true
  try {
    await $fetch(`/api/admin/posts/${tagModal.post.id}/tag`, {
      method: 'PUT',
      body:   { tag: tagModal.tag }
    })
    tagModal.post.tag = tagModal.tag
    tagModal.show     = false
    toast.add({ title: `标签已更新为「${tagLabel(tagModal.tag)}」`, color: 'green' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { tagModal.loading = false }
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}

onMounted(loadList)
</script>
