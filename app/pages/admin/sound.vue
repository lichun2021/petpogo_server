<template>
  <div class="space-y-4">

    <!-- 顶部：猫 / 狗 切换 -->
    <div class="flex items-center gap-3">
      <button
        v-for="pt in petTypes" :key="pt.value"
        class="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border-2 transition-all duration-150"
        :style="activePetType === pt.value
          ? `background: ${pt.bg}; border-color: ${pt.color}; color: ${pt.color}; box-shadow: 0 4px 12px ${pt.color}30`
          : 'background: #fff; border-color: #e2d9d0; color: #78716c; box-shadow: 0 1px 4px rgba(0,0,0,0.04)'"
        @click="selectPetType(pt.value)"
      >
        <span class="text-xl">{{ pt.emoji }}</span>
        <span>{{ pt.label }}</span>
      </button>
      <div class="flex-1" />
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border text-stone-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-all"
        style="border-color:#e2d9d0"
        @click="openAddEmotion"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        新增情绪类型
      </button>
    </div>

    <!-- 情绪 × 声音 列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <!-- 表头 -->
      <div class="grid px-5 py-2.5 border-b text-xs font-semibold text-stone-400 uppercase tracking-wide"
        style="grid-template-columns: 180px 1fr 120px 80px 110px; border-color: #f0e6d8; background: #faf8f5">
        <span>情绪类型</span>
        <span>声音 URL</span>
        <span class="text-center">上传声音</span>
        <span class="text-center">状态</span>
        <span class="text-right">操作</span>
      </div>

      <!-- 加载中 -->
      <div v-if="emotionLoading" class="flex items-center justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-amber-400 animate-spin" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="!emotions.length" class="flex flex-col items-center justify-center py-16 text-stone-400">
        <span class="text-4xl mb-3">🎵</span>
        <p class="text-sm">暂无情绪类型，点击「新增情绪类型」添加</p>
      </div>

      <!-- 列表行 -->
      <template v-else>
        <div v-for="e in emotions" :key="e.id"
          class="grid px-5 py-4 border-b items-center transition-colors hover:bg-amber-50/30"
          style="grid-template-columns: 180px 1fr 120px 80px 110px; border-color: #f5ede4">

          <!-- 情绪标签 -->
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
              :style="`background: ${e.active_bg}`">{{ e.emoji }}</div>
            <div>
              <p class="text-sm font-semibold text-stone-700">{{ e.label }}</p>
              <p class="text-xs text-stone-400 font-mono">{{ e.value }}</p>
            </div>
          </div>

          <!-- URL 显示 -->
          <div class="flex items-center gap-2 min-w-0 pr-3">
            <template v-if="e.url">
              <button
                class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                :style="playingId === e.id ? 'background:#fde68a;color:#d97706' : 'background:#f0e6d8;color:#a8917a'"
                @click="togglePlay(e)">
                <UIcon :name="playingId === e.id ? 'i-heroicons-stop' : 'i-heroicons-play'" class="w-3.5 h-3.5" />
              </button>
              <span class="text-xs text-stone-400 font-mono truncate">{{ e.url }}</span>
            </template>
            <span v-else class="text-xs text-stone-300 italic">未上传声音</span>
          </div>

          <!-- 上传按钮 -->
          <div class="flex justify-center">
            <label
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all"
              :style="uploadingId === e.id
                ? 'background:#fef3c7;border-color:#fde68a;color:#92400e'
                : 'background:#faf8f5;border-color:#e2d9d0;color:#78716c;hover:border-amber-300'"
            >
              <UIcon v-if="uploadingId === e.id" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
              <UIcon v-else name="i-heroicons-arrow-up-tray" class="w-3.5 h-3.5" />
              {{ uploadingId === e.id ? '上传中…' : (e.url ? '重新上传' : '上传') }}
              <input type="file" accept="audio/*" class="hidden" @change="uploadSound($event, e)" />
            </label>
          </div>

          <!-- 状态 -->
          <div class="flex justify-center">
            <button class="px-2 py-0.5 rounded-full text-xs font-medium border transition-all"
              :style="e.status===1 ? 'background:#d1fae5;color:#065f46;border-color:#a7f3d0' : 'background:#fef2f2;color:#991b1b;border-color:#fecaca'"
              @click="toggleEmotionStatus(e)">{{ e.status===1 ? '启用' : '禁用' }}</button>
          </div>

          <!-- 操作 -->
          <div class="flex items-center justify-end gap-1">
            <div class="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm" :style="`background:${e.color}`" />
            <button class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-all" @click="openEditEmotion(e)">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
            </button>
            <button class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all" @click="deleteEmotion(e)">
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>
    </div>

  </div>

  <!-- ═══ 新增/编辑情绪弹窗 ═══ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="modal.show=false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style="border:1px solid #f0e6d8">
          <div class="flex items-center justify-between mb-5">
            <p class="font-bold text-stone-800">{{ modal.isEdit ? '编辑情绪类型' : '新增情绪类型' }}</p>
            <button class="text-stone-400 hover:text-stone-600" @click="modal.show=false">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">标识（英文，不可改）</label>
                <input v-model="form.value" :disabled="modal.isEdit" type="text" placeholder="happy"
                  class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition disabled:bg-stone-50 disabled:text-stone-400"
                  style="border-color:#e2d9d0" />
              </div>
              <div>
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">中文名</label>
                <input v-model="form.label" type="text" placeholder="开心"
                  class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                  style="border-color:#e2d9d0" />
              </div>
              <div>
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">表情符号</label>
                <input v-model="form.emoji" type="text" placeholder="😄"
                  class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                  style="border-color:#e2d9d0" />
              </div>
              <div>
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">主色</label>
                <div class="flex gap-2">
                  <input v-model="form.color" type="color" class="w-10 h-10 rounded-lg border cursor-pointer p-0.5" style="border-color:#e2d9d0" />
                  <input v-model="form.color" type="text"
                    class="flex-1 px-3 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono transition"
                    style="border-color:#e2d9d0" />
                </div>
              </div>
            </div>

            <!-- 声音 URL（可选） -->
            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">声音 URL（可留空后续上传）</label>
              <div class="flex gap-2">
                <input v-model="form.url" type="text" placeholder="https://cdn.example.com/sound/happy.mp3"
                  class="flex-1 px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                  style="border-color:#e2d9d0" />
                <button v-if="form.url"
                  class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  :style="previewPlaying ? 'background:#fde68a;color:#d97706' : 'background:#f0e6d8;color:#a8917a'"
                  @click="togglePreview">
                  <UIcon :name="previewPlaying ? 'i-heroicons-stop' : 'i-heroicons-play'" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- 排序 & 状态 -->
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">排序权重</label>
                <input v-model.number="form.sortOrder" type="number" min="0"
                  class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                  style="border-color:#e2d9d0" />
              </div>
              <div>
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">状态</label>
                <div class="flex gap-1.5 pt-0.5">
                  <button class="px-3 py-2.5 rounded-xl text-xs font-medium border transition-all"
                    :style="form.status===1 ? 'background:#d1fae5;border-color:#6ee7b7;color:#065f46' : 'background:#faf8f5;border-color:#e2d9d0;color:#78716c'"
                    @click="form.status=1">启用</button>
                  <button class="px-3 py-2.5 rounded-xl text-xs font-medium border transition-all"
                    :style="form.status===0 ? 'background:#fef2f2;border-color:#fca5a5;color:#991b1b' : 'background:#faf8f5;border-color:#e2d9d0;color:#78716c'"
                    @click="form.status=0">禁用</button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button class="flex-1 py-2.5 rounded-xl text-sm font-medium border text-stone-600 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="modal.show=false">取消</button>
            <button class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style="background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 2px 8px rgba(245,158,11,0.3)"
              :disabled="saving" @click="saveEmotion">
              <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-1" />
              {{ saving ? '保存中…' : (modal.isEdit ? '保存修改' : '新增') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <audio ref="audioEl" @ended="playingId=null; previewPlaying=false" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: '情绪声音管理 — 萌宠帮后台' })

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` })

// ── 宠物类型 ──────────────────────────────────────────
const petTypes = [
  { value: 'cat', label: '猫咪', emoji: '🐱', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'dog', label: '狗狗', emoji: '🐶', color: '#3b82f6', bg: '#dbeafe' },
]
const activePetType = ref('cat')

function selectPetType(v: string) {
  activePetType.value = v
  loadEmotions()
}

// ── 情绪类型（含声音URL） ─────────────────────────────
const emotions       = ref<any[]>([])
const emotionLoading = ref(false)

async function loadEmotions() {
  emotionLoading.value = true
  try {
    const data: any = await $fetch('/api/admin/sound/emotion/list', {
      params: { petType: activePetType.value },
      headers: authHeader(),
    })
    emotions.value = data.list ?? []
  } finally {
    emotionLoading.value = false
  }
}

onMounted(() => loadEmotions())

// ── 状态切换 ──────────────────────────────────────────
async function toggleEmotionStatus(e: any) {
  const s = e.status === 1 ? 0 : 1
  await $fetch(`/api/admin/sound/emotion/${e.id}`, { method:'PUT', body:{ status:s }, headers:authHeader() })
  e.status = s
}

// ── 删除 ──────────────────────────────────────────────
async function deleteEmotion(e: any) {
  if (!confirm(`确定删除情绪类型「${e.label}」？删除后该情绪下的声音数据不会自动删除。`)) return
  await $fetch(`/api/admin/sound/emotion/${e.id}`, { method:'DELETE', headers:authHeader() })
  await loadEmotions()
}

// ── 音频播放 ──────────────────────────────────────────
const audioEl        = ref<HTMLAudioElement|null>(null)
const playingId      = ref<number|null>(null)
const previewPlaying = ref(false)

function togglePlay(e: any) {
  const a = audioEl.value; if (!a) return
  if (playingId.value === e.id) { a.pause(); a.currentTime=0; playingId.value=null }
  else { a.src=e.url; a.play(); playingId.value=e.id; previewPlaying.value=false }
}
function togglePreview() {
  const a = audioEl.value; if (!a || !form.url) return
  if (previewPlaying.value) { a.pause(); a.currentTime=0; previewPlaying.value=false }
  else { a.src=form.url; a.play(); previewPlaying.value=true; playingId.value=null }
}

// ── 上传声音 ──────────────────────────────────────────
const uploadingId = ref<number|null>(null)

async function uploadSound(event: Event, emotion: any) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingId.value = emotion.id
  try {
    // 1. 获取预签名 URL
    const sign: any = await $fetch('/api/admin/sound/emotion/upload-sign', {
      method: 'POST',
      body: { mimeType: file.type },
      headers: authHeader(),
    })
    // 2. 直传 OSS
    await $fetch(sign.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    // 3. 保存 URL 到情绪表
    await $fetch(`/api/admin/sound/emotion/${emotion.id}`, {
      method: 'PUT',
      body: { url: sign.cdnUrl },
      headers: authHeader(),
    })
    emotion.url = sign.cdnUrl
    // 自动播放预览
    const a = audioEl.value
    if (a) { a.src = sign.cdnUrl; a.play(); playingId.value = emotion.id }
  } catch (err: any) {
    alert('上传失败：' + (err?.message ?? '未知错误'))
  } finally {
    uploadingId.value = null
    ;(event.target as HTMLInputElement).value = ''
  }
}

// ── 情绪弹窗表单 ──────────────────────────────────────
const modal  = reactive({ show:false, isEdit:false, editId:null as number|null })
const saving = ref(false)
const form   = reactive({ value:'', label:'', emoji:'😄', color:'#f59e0b', url:'', sortOrder:0, status:1 })

function openAddEmotion() {
  form.value=''; form.label=''; form.emoji='😄'; form.color='#f59e0b'
  form.url=''; form.sortOrder=0; form.status=1
  modal.isEdit=false; modal.editId=null; modal.show=true
}
function openEditEmotion(e: any) {
  form.value=e.value; form.label=e.label; form.emoji=e.emoji; form.color=e.color
  form.url=e.url||''; form.sortOrder=e.sort_order; form.status=e.status
  modal.isEdit=true; modal.editId=e.id; modal.show=true
}
async function saveEmotion() {
  if (!form.value.trim()) { alert('请填写情绪标识'); return }
  if (!form.label.trim()) { alert('请填写中文名'); return }
  saving.value=true
  const activeBg  = form.color + '25'
  const textColor = form.color
  try {
    if (modal.isEdit && modal.editId) {
      await $fetch(`/api/admin/sound/emotion/${modal.editId}`, {
        method:'PUT',
        body:{ label:form.label, emoji:form.emoji, color:form.color, activeBg, textColor, url:form.url||null, sortOrder:form.sortOrder, status:form.status },
        headers:authHeader()
      })
    } else {
      await $fetch('/api/admin/sound/emotion/create', {
        method:'POST',
        body:{ petType:activePetType.value, value:form.value, label:form.label, emoji:form.emoji, color:form.color, activeBg, textColor, url:form.url||null, sortOrder:form.sortOrder },
        headers:authHeader()
      })
    }
    modal.show=false; await loadEmotions()
  } finally { saving.value=false }
}
</script>

<style scoped>
.modal-enter-active,.modal-leave-active { transition: all 0.2s ease }
.modal-enter-from,.modal-leave-to { opacity:0; transform:scale(0.96) }
</style>
