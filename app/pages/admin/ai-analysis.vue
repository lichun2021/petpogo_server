<template>
  <div class="space-y-4">
    <!-- 顶部统计 -->
    <div class="grid grid-cols-3 gap-4">
      <div v-for="s in summary" :key="s.label"
        class="bg-white rounded-2xl p-4 border flex items-center gap-4"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div :class="['w-10 h-10 rounded-xl flex items-center justify-center text-xl', s.bg]">
          {{ s.emoji }}
        </div>
        <div>
          <p class="text-xs text-stone-400">{{ s.label }}</p>
          <p class="text-2xl font-bold text-stone-800">{{ s.value }}</p>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="bg-white rounded-2xl border p-4 flex flex-wrap gap-3 items-center"
      style="border-color: #f0e6d8"
    >
      <div class="flex gap-1 rounded-lg overflow-hidden border" style="border-color: #f0e6d8">
        <button
          v-for="t in typeOpts" :key="t.value"
          @click="filter.type = t.value; load()"
          :class="['px-3 py-1.5 text-xs font-medium transition-colors',
            filter.type === t.value
              ? 'bg-amber-500 text-white'
              : 'text-stone-500 hover:bg-amber-50']"
        >{{ t.label }}</button>
      </div>
      <div class="flex gap-1 rounded-lg overflow-hidden border" style="border-color: #f0e6d8">
        <button
          v-for="s in successOpts" :key="s.value"
          @click="filter.success = s.value; load()"
          :class="['px-3 py-1.5 text-xs font-medium transition-colors',
            filter.success === s.value
              ? 'bg-amber-500 text-white'
              : 'text-stone-500 hover:bg-amber-50']"
        >{{ s.label }}</button>
      </div>
      <input
        v-model="filter.userId"
        @keyup.enter="load()"
        placeholder="用户 ID 搜索..."
        class="border rounded-lg px-3 py-1.5 text-xs text-stone-700 outline-none focus:ring-1 focus:ring-amber-300"
        style="border-color: #f0e6d8; width: 160px"
      />
      <button @click="load()" class="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 transition-colors">
        搜索
      </button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="py-16 text-center text-stone-400 text-sm">加载中...</div>
      <div v-else-if="!list.length" class="py-16 text-center text-stone-400 text-sm">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b" style="border-color: #f0e6d8; background: #fdf8f3">
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">类型</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">用户</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">资源</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">识别结果</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">状态</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">耗时</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-stone-500">时间</th>
          </tr>
        </thead>
        <tbody class="divide-y" style="divide-color: #faf6f2">
          <tr v-for="r in list" :key="r.id" class="hover:bg-amber-50/40 transition-colors cursor-pointer" @click="openDetail(r)">
            <!-- 类型 -->
            <td class="px-4 py-3">
              <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                r.mediaType === 'image' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600']">
                {{ r.mediaType === 'image' ? '📸 图片' : '🎙️ 音频' }}
              </span>
            </td>
            <!-- 用户 -->
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img v-if="r.user_avatar" :src="r.user_avatar" class="w-6 h-6 rounded-full object-cover" />
                <div v-else class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">
                  {{ (r.nickname || '?')[0] }}
                </div>
                <span class="text-xs text-stone-600 truncate max-w-20">{{ r.nickname || r.user_id }}</span>
              </div>
            </td>
            <!-- 资源缩略 -->
            <td class="px-4 py-3">
              <div v-if="r.mediaType === 'image'" class="flex items-center gap-2">
                <img :src="r.image_url" class="w-10 h-10 rounded-lg object-cover border" style="border-color: #f0e6d8" />
              </div>
              <div v-else class="flex items-center gap-1 text-xs text-stone-400">
                <UIcon name="i-heroicons-musical-note" class="w-4 h-4" />
                <span class="truncate max-w-24">音频</span>
              </div>
            </td>
            <!-- 识别结果 -->
            <td class="px-4 py-3">
              <div v-if="r.emotion_zh" class="text-xs">
                <span class="font-semibold text-stone-700">{{ r.emotion_zh }}</span>
                <span class="text-stone-400 ml-1">({{ r.species || '' }})</span>
                <div class="text-stone-400 mt-0.5">
                  置信 {{ ((r.emotion_conf || 0) * 100).toFixed(0) }}%
                </div>
              </div>
              <span v-else class="text-xs text-stone-400">—</span>
            </td>
            <!-- 状态 -->
            <td class="px-4 py-3">
              <UBadge
                :label="r.success ? '成功' : '非宠物'"
                :color="r.success ? 'green' : 'red'"
                variant="subtle" size="xs"
              />
            </td>
            <!-- 耗时 -->
            <td class="px-4 py-3 text-xs text-stone-500">
              {{ r.processing_ms ? r.processing_ms + 'ms' : '—' }}
            </td>
            <!-- 时间 -->
            <td class="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">
              {{ fmtTime(r.created_at) }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div v-if="list.length" class="flex items-center justify-between px-4 py-3 border-t" style="border-color: #f0e6d8">
        <span class="text-xs text-stone-400">共 {{ total }} 条</span>
        <div class="flex gap-1">
          <button @click="prevPage" :disabled="page <= 1"
            class="px-2.5 py-1 text-xs rounded border disabled:opacity-40 hover:bg-amber-50 transition-colors"
            style="border-color: #f0e6d8">上一页</button>
          <span class="px-3 py-1 text-xs text-stone-500">{{ page }}</span>
          <button @click="nextPage" :disabled="page * size >= total"
            class="px-2.5 py-1 text-xs rounded border disabled:opacity-40 hover:bg-amber-50 transition-colors"
            style="border-color: #f0e6d8">下一页</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <UModal v-model="showModal">
      <div class="p-6 space-y-4 max-w-lg">
        <h3 class="font-bold text-stone-800 text-base">
          {{ detail?.mediaType === 'image' ? '📸 图片分析详情' : '🎙️ 音频分析详情' }}
        </h3>
        <div v-if="detail">
          <!-- 图片预览 -->
          <img v-if="detail.mediaType === 'image'" :src="detail.image_url"
            class="w-full rounded-xl object-cover max-h-64" />
          <!-- 音频链接 -->
          <a v-else :href="detail.audio_url" target="_blank"
            class="block text-xs text-amber-600 underline break-all">
            {{ detail.audio_url }}
          </a>

          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="space-y-1">
              <p class="text-stone-400">用户</p>
              <p class="font-medium text-stone-700">{{ detail.nickname || detail.user_id }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-stone-400">状态</p>
              <p :class="detail.success ? 'text-green-600' : 'text-red-500'" class="font-medium">
                {{ detail.success ? '识别成功' : '非宠物图片' }}
              </p>
            </div>
            <div v-if="detail.emotion_zh" class="space-y-1">
              <p class="text-stone-400">主情绪</p>
              <p class="font-medium text-stone-700">{{ detail.emotion_zh }} ({{ ((detail.emotion_conf||0)*100).toFixed(0) }}%)</p>
            </div>
            <div v-if="detail.species" class="space-y-1">
              <p class="text-stone-400">物种</p>
              <p class="font-medium text-stone-700">{{ detail.species }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-stone-400">处理耗时</p>
              <p class="font-medium text-stone-700">{{ detail.processing_ms }}ms</p>
            </div>
            <div class="space-y-1">
              <p class="text-stone-400">时间</p>
              <p class="font-medium text-stone-700">{{ fmtTime(detail.created_at) }}</p>
            </div>
          </div>

          <!-- Top3 -->
          <div v-if="detail.top3?.length" class="mt-3">
            <p class="text-xs text-stone-400 mb-2">情绪分布</p>
            <div v-for="e in detail.top3" :key="e.label" class="flex items-center gap-2 mb-1.5">
              <span class="text-xs text-stone-600 w-14 flex-shrink-0">{{ e.label_zh || e.label }}</span>
              <div class="flex-1 bg-stone-100 rounded-full h-2">
                <div class="bg-amber-400 h-2 rounded-full" :style="`width: ${(e.confidence*100).toFixed(0)}%`"></div>
              </div>
              <span class="text-xs text-stone-400 w-8 text-right">{{ (e.confidence*100).toFixed(0) }}%</span>
            </div>
          </div>

          <!-- 建议 -->
          <div v-if="detail.advice" class="mt-3 p-3 rounded-xl text-xs text-stone-600"
            style="background: #fef3c7">
            💡 {{ detail.advice }}
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminAiAnalysis' })
definePageMeta({ layout: 'admin' })

const typeOpts    = [
  { value: '',      label: '全部' },
  { value: 'image', label: '📸 图片' },
  { value: 'voice', label: '🎙️ 音频' },
]
const successOpts = [
  { value: '',      label: '全部' },
  { value: 'true',  label: '成功' },
  { value: 'false', label: '非宠物' },
]

const filter    = reactive({ type: '', success: '', userId: '' })
const list      = ref<any[]>([])
const loading   = ref(false)
const page      = ref(1)
const size      = 20
const total     = ref(0)
const totalImage = ref(0)
const totalVoice = ref(0)
const showModal = ref(false)
const detail    = ref<any>(null)

const summary = computed(() => [
  { label: '图片分析总数', value: totalImage.value, emoji: '📸', bg: 'bg-blue-50' },
  { label: '音频分析总数', value: totalVoice.value, emoji: '🎙️', bg: 'bg-purple-50' },
  { label: '本页总数',    value: list.value.length, emoji: '📊', bg: 'bg-amber-50' },
])

async function load() {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/admin/ai-analysis', {
      query: { type: filter.type, success: filter.success, userId: filter.userId, page: page.value, size }
    })
    list.value       = res.list       || []
    total.value      = (res.totalImage || 0) + (res.totalVoice || 0)
    totalImage.value = res.totalImage || 0
    totalVoice.value = res.totalVoice || 0
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function prevPage() { if (page.value > 1) { page.value--; load() } }
function nextPage() { page.value++; load() }

function openDetail(row: any) { detail.value = row; showModal.value = true }

function fmtTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(load)
</script>
