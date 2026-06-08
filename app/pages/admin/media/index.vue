<template>
  <div class="space-y-4">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="card in statCards" :key="card.label"
        class="bg-white rounded-2xl p-4 border flex items-center gap-3"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" :style="`background:${card.bg}`">
          {{ card.emoji }}
        </div>
        <div>
          <p class="text-xs text-stone-400 mb-0.5">{{ card.label }}</p>
          <p class="text-xl font-bold text-stone-800">{{ card.value }}</p>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="bg-white rounded-2xl border px-5 py-3.5 flex items-center gap-3" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <!-- 类型筛选 -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="t in typeOptions" :key="t.value"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
          :style="activeType === t.value
            ? 'background:#fef3c7;border-color:#fde68a;color:#92400e'
            : 'background:transparent;border-color:#e2d9d0;color:#78716c'"
          @click="setType(t.value)"
        >{{ t.label }}</button>
      </div>

      <!-- 搜索 -->
      <div class="relative max-w-xs flex-1">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索用户昵称…"
          class="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none transition"
          style="border-color: #e2d9d0"
          @keydown.enter="loadData"
        />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" size="sm" :loading="loading" @click="loadData" />
      </div>
    </div>

    <!-- 图库网格 -->
    <div v-if="loading" class="py-20 flex items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-amber-400 animate-spin" />
    </div>
    <div v-else-if="!list.length" class="py-20 flex flex-col items-center gap-2 text-stone-400">
      <span class="text-4xl">🖼️</span>
      <p class="text-sm">暂无媒体文件</p>
    </div>
    <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
      <div
        v-for="item in list" :key="item.id"
        class="group relative rounded-2xl overflow-hidden bg-stone-100 cursor-pointer"
        style="aspect-ratio: 1; box-shadow: 0 1px 4px rgba(0,0,0,0.08)"
        @click="openPreview(item)"
      >
        <!-- 缩略图 -->
        <img
          :src="item.thumb_url || item.url"
          :alt="item.nickname"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          @error="onImgError"
        />

        <!-- 视频标识 -->
        <div v-if="item.type === 2" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(0,0,0,0.45)">
            <UIcon name="i-heroicons-play-solid" class="w-5 h-5 text-white ml-0.5" />
          </div>
        </div>

        <!-- hover 遮罩 + 操作 -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex flex-col justify-between p-2.5">
          <!-- 用户信息（hover 才出现） -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
            <UAvatar :src="item.avatar" :alt="item.nickname" size="xs" class="flex-shrink-0 ring-1 ring-white" />
            <p class="text-[11px] font-medium text-white drop-shadow truncate">{{ item.nickname || '未命名' }}</p>
          </div>
          <!-- 删除按钮（hover 才出现） -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end" @click.stop>
            <UButton
              icon="i-heroicons-trash"
              color="red"
              variant="solid"
              size="xs"
              class="shadow"
              @click="deleteMedia(item)"
            />
          </div>
        </div>

        <!-- 时间标签（常显） -->
        <div class="absolute bottom-0 left-0 right-0 px-2 py-1 group-hover:opacity-0 transition-opacity" style="background: linear-gradient(transparent, rgba(0,0,0,0.5))">
          <p class="text-[10px] text-white/80">{{ formatDate(item.created_at) }}</p>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="flex items-center justify-between px-1">
      <p class="text-xs text-stone-400">共 {{ total }} 个文件</p>
      <div class="flex items-center gap-1">
        <UButton icon="i-heroicons-chevron-left" color="gray" variant="ghost" size="xs" :disabled="page <= 1" @click="page--; loadData()" />
        <span class="text-xs text-stone-500 px-2">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
        <UButton icon="i-heroicons-chevron-right" color="gray" variant="ghost" size="xs" :disabled="page >= Math.ceil(total / pageSize)" @click="page++; loadData()" />
      </div>
    </div>

    <!-- 预览弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="preview"
          class="fixed inset-0 z-50 flex items-center justify-center"
          style="background: rgba(0,0,0,0.85)"
          @click.self="preview = null"
        >
          <!-- 关闭 -->
          <button
            class="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            @click="preview = null"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>

          <!-- 左右切换 -->
          <button v-if="previewIndex > 0" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" @click="shiftPreview(-1)">
            <UIcon name="i-heroicons-chevron-left" class="w-6 h-6" />
          </button>
          <button v-if="previewIndex < list.length - 1" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" @click="shiftPreview(1)">
            <UIcon name="i-heroicons-chevron-right" class="w-6 h-6" />
          </button>

          <!-- 图片预览 -->
          <img
            v-if="preview.type === 1"
            :src="preview.url"
            class="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            style="user-select:none"
          />

          <!-- 视频预览 -->
          <video
            v-else
            :src="preview.url"
            controls
            autoplay
            class="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl bg-black"
            style="outline:none"
          />

          <!-- 底部信息 -->
          <div class="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
            <div class="flex items-center gap-2">
              <UAvatar :src="preview.avatar" :alt="preview.nickname" size="xs" />
              <p class="text-sm text-white font-medium">{{ preview.nickname || '未命名' }}</p>
            </div>
            <p class="text-xs text-white/50">{{ formatDateFull(preview.created_at) }}
              <span v-if="preview.file_size"> · {{ formatSize(preview.file_size) }}</span>
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminMedia' })
definePageMeta({ layout: 'admin' })

// ── 状态 ──────────────────────────────────────────
const loading    = ref(false)
const list       = ref<any[]>([])
const total      = ref(0)
const page       = ref(1)
const pageSize   = ref(40)
const keyword    = ref('')
const activeType = ref<number | null>(null)
const preview    = ref<any>(null)
const previewIndex = ref(0)

const statsData = ref({ total: 0, images: 0, videos: 0, totalSize: 0 })

const typeOptions = [
  { value: null, label: '全部' },
  { value: 1,    label: '🖼️ 图片' },
  { value: 2,    label: '🎬 视频' },
]

const statCards = computed(() => [
  { label: '全部文件', value: statsData.value.total,  emoji: '🗂️', bg: '#fef3c7' },
  { label: '图片',     value: statsData.value.images, emoji: '🖼️', bg: '#eff6ff' },
  { label: '视频',     value: statsData.value.videos, emoji: '🎬', bg: '#f0fdf4' },
])

// ── 数据加载 ──────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (activeType.value !== null) params.type    = activeType.value
    if (keyword.value)             params.keyword = keyword.value

    const data = await $fetch<any>('/api/admin/media', { params })
    list.value      = data.list
    total.value     = data.total
    statsData.value = data.stats
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function setType(val: number | null) {
  activeType.value = activeType.value === val ? null : val
  page.value = 1
  loadData()
}

// ── 预览 ──────────────────────────────────────────
function openPreview(item: any) {
  previewIndex.value = list.value.indexOf(item)
  preview.value = item
}
function shiftPreview(delta: number) {
  const idx = previewIndex.value + delta
  if (idx >= 0 && idx < list.value.length) {
    previewIndex.value = idx
    preview.value = list.value[idx]
  }
}

// ── 删除 ──────────────────────────────────────────
async function deleteMedia(item: any) {
  if (!confirm(`确定删除这个${item.type === 1 ? '图片' : '视频'}？`)) return
  try {
    await $fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' })
    list.value = list.value.filter(i => i.id !== item.id)
    total.value--
    if (preview.value?.id === item.id) preview.value = null
    statsData.value.total--
    if (item.type === 1) statsData.value.images--
    else                  statsData.value.videos--
  } catch (e) {
    console.error(e)
  }
}

// ── 工具函数 ──────────────────────────────────────
function formatDate(dt: string) {
  if (!dt) return ''
  const d = new Date(dt)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function formatDateFull(dt: string) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

// 键盘左右切换
function onKeydown(e: KeyboardEvent) {
  if (!preview.value) return
  if (e.key === 'ArrowLeft')  shiftPreview(-1)
  if (e.key === 'ArrowRight') shiftPreview(1)
  if (e.key === 'Escape')     preview.value = null
}

onMounted(() => {
  loadData()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
