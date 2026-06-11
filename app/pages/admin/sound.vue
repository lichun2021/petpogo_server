<template>
  <div class="space-y-4">

    <!-- 顶部：猫 / 狗 切换 + 新增 -->
    <div class="flex items-center gap-3">
      <button
        v-for="pt in petTypes" :key="pt.value"
        class="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border-2 transition-all duration-150"
        :style="activePetType === pt.value
          ? `background:${pt.bg};border-color:${pt.color};color:${pt.color};box-shadow:0 4px 12px ${pt.color}30`
          : 'background:#fff;border-color:#e2d9d0;color:#78716c'"
        @click="selectPetType(pt.value)"
      >
        <span class="text-xl">{{ pt.emoji }}</span>
        <span>{{ pt.label }}</span>
        <span class="text-xs font-normal opacity-70">{{ counts[pt.value] ?? 0 }} 条</span>
      </button>
      <div class="flex-1" />
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
        style="background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 2px 8px rgba(245,158,11,0.3)"
        @click="openAdd"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        新增声音
      </button>
    </div>

    <!-- 声音列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:#f0e6d8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">

      <!-- 表头 -->
      <div class="grid px-5 py-2.5 border-b text-xs font-semibold text-stone-400 uppercase tracking-wide"
        style="grid-template-columns:140px 1fr 110px 80px 120px;border-color:#f0e6d8;background:#faf8f5">
        <span>情绪标签</span>
        <span>声音名称 / URL</span>
        <span class="text-center">试听</span>
        <span class="text-center">状态</span>
        <span class="text-right">操作</span>
      </div>

      <!-- 加载 -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-amber-400 animate-spin" />
      </div>

      <!-- 空 -->
      <div v-else-if="!list.length" class="flex flex-col items-center justify-center py-16 text-stone-400">
        <span class="text-4xl mb-3">🎵</span>
        <p class="text-sm">暂无预设声音，点击「新增声音」添加</p>
      </div>

      <!-- 行 -->
      <template v-else>
        <div v-for="item in list" :key="item.id"
          class="grid px-5 py-3.5 border-b items-center hover:bg-amber-50/30 transition-colors"
          style="grid-template-columns:140px 1fr 110px 80px 120px;border-color:#f5ede4">

          <!-- 情绪标签 -->
          <div>
            <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
              style="background:#fef3c7;color:#92400e">
              {{ item.emotion || '未分类' }}
            </span>
          </div>

          <!-- 名称 + URL -->
          <div class="min-w-0 pr-4">
            <p class="text-sm font-medium text-stone-700 truncate">{{ item.name }}</p>
            <p class="text-xs text-stone-400 font-mono truncate mt-0.5">{{ item.url }}</p>
          </div>

          <!-- 试听 -->
          <div class="flex justify-center">
            <button
              class="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              :style="playingId === item.id ? 'background:#fde68a;color:#d97706' : 'background:#f0e6d8;color:#a8917a'"
              @click="togglePlay(item)"
            >
              <UIcon :name="playingId === item.id ? 'i-heroicons-stop' : 'i-heroicons-play'" class="w-4 h-4" />
            </button>
          </div>

          <!-- 状态 -->
          <div class="flex justify-center">
            <button class="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              :style="item.status===1 ? 'background:#d1fae5;color:#065f46;border-color:#a7f3d0' : 'background:#fef2f2;color:#991b1b;border-color:#fecaca'"
              @click="toggleStatus(item)">
              {{ item.status===1 ? '启用' : '禁用' }}
            </button>
          </div>

          <!-- 操作 -->
          <div class="flex items-center justify-end gap-1">
            <!-- 重新上传 -->
            <label class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer" :title="uploadingId===item.id?'上传中…':'重新上传'">
              <UIcon v-if="uploadingId===item.id" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-amber-500" />
              <UIcon v-else name="i-heroicons-arrow-up-tray" class="w-4 h-4" />
              <input type="file" accept="audio/*" class="hidden" @change="uploadSound($event, item)" />
            </label>
            <button class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-all" @click="openEdit(item)">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
            </button>
            <button class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all" @click="confirmDelete(item)">
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <button :disabled="page===1" class="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="page--;loadData()">上一页</button>
      <span class="text-sm text-stone-500">{{ page }} / {{ totalPages }}</span>
      <button :disabled="page===totalPages" class="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="page++;loadData()">下一页</button>
    </div>

  </div>

  <!-- ═══ 新增/编辑弹窗 ═══ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeModal" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style="border:1px solid #f0e6d8">

          <div class="flex items-center justify-between mb-5">
            <p class="font-bold text-stone-800">{{ modal.isEdit ? '编辑预设声音' : '新增预设声音' }}</p>
            <button class="text-stone-400 hover:text-stone-600" @click="closeModal">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">

            <!-- 情绪标签（纯文本，自由填写） -->
            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">情绪标签（英文，如 happy）</label>
              <input v-model="form.emotion" type="text" placeholder="happy / sad / calm …"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color:#e2d9d0" />
            </div>

            <!-- 声音名称 -->
            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">声音名称 <span class="text-red-400">*</span></label>
              <input v-model="form.name" type="text" placeholder="系统默认-开心"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color:#e2d9d0" />
            </div>

            <!-- 声音 URL + 上传 -->
            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">声音 URL <span class="text-red-400">*</span></label>
              <div class="flex gap-2">
                <input v-model="form.url" type="text" placeholder="https://cdn.../sound.mp3"
                  class="flex-1 px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                  style="border-color:#e2d9d0" />
                <!-- 试听 -->
                <button v-if="form.url"
                  class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  :style="previewPlaying ? 'background:#fde68a;color:#d97706' : 'background:#f0e6d8;color:#a8917a'"
                  @click="togglePreview">
                  <UIcon :name="previewPlaying ? 'i-heroicons-stop' : 'i-heroicons-play'" class="w-4 h-4" />
                </button>
                <!-- 上传 -->
                <label class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                  :style="modalUploading ? 'background:#fef3c7;color:#92400e' : 'background:#f0e6d8;color:#a8917a'">
                  <UIcon v-if="modalUploading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                  <UIcon v-else name="i-heroicons-arrow-up-tray" class="w-4 h-4" />
                  <input type="file" accept="audio/*" class="hidden" @change="uploadInModal" />
                </label>
              </div>
              <p class="text-xs text-stone-400 mt-1">可直接填写 URL，也可点击 ↑ 上传音频文件</p>
            </div>

            <!-- 排序 & 状态 -->
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-xs font-semibold text-stone-500 mb-1.5 block">排序</label>
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
            <button class="flex-1 py-2.5 rounded-xl text-sm font-medium border text-stone-600 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="closeModal">取消</button>
            <button class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style="background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 2px 8px rgba(245,158,11,0.3)"
              :disabled="saving" @click="save">
              <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-1" />
              {{ saving ? '保存中…' : (modal.isEdit ? '保存修改' : '新增') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <audio ref="audioEl" @ended="playingId=null;previewPlaying=false" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: '预设声音管理 — 萌宠帮后台' })

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` })

// ── 宠物类型 ──────────────────────────────────────────
const petTypes = [
  { value: 'cat', label: '猫咪', emoji: '🐱', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'dog', label: '狗狗', emoji: '🐶', color: '#3b82f6', bg: '#dbeafe' },
]
const activePetType = ref('cat')
const counts = ref<Record<string, number>>({})

function selectPetType(v: string) {
  activePetType.value = v; page.value = 1; loadData()
}

// ── 列表 ──────────────────────────────────────────────
const loading    = ref(false)
const list       = ref<any[]>([])
const total      = ref(0)
const page       = ref(1)
const pageSize   = 20
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function loadData() {
  loading.value = true
  try {
    const data: any = await $fetch('/api/admin/sound/preset/list', {
      params: { petType: activePetType.value, page: page.value, pageSize },
      headers: authHeader(),
    })
    list.value  = data.list  ?? []
    total.value = data.total ?? 0
  } finally { loading.value = false }
}

async function loadCounts() {
  const results = await Promise.all(
    petTypes.map(pt =>
      $fetch<any>('/api/admin/sound/preset/list', {
        params: { petType: pt.value, pageSize: 1 },
        headers: authHeader(),
      }).then(d => ({ v: pt.value, t: d.total ?? 0 })).catch(() => ({ v: pt.value, t: 0 }))
    )
  )
  results.forEach(r => { counts.value[r.v] = r.t })
}

onMounted(() => { loadData(); loadCounts() })

// ── 状态 / 删除 ───────────────────────────────────────
async function toggleStatus(item: any) {
  const s = item.status === 1 ? 0 : 1
  await $fetch(`/api/admin/sound/preset/${item.id}`, { method:'PUT', body:{ status:s }, headers:authHeader() })
  item.status = s
}
async function confirmDelete(item: any) {
  if (!confirm(`确定删除「${item.name}」？`)) return
  await $fetch(`/api/admin/sound/preset/${item.id}`, { method:'DELETE', headers:authHeader() })
  await loadData(); await loadCounts()
}

// ── 音频播放 ──────────────────────────────────────────
const audioEl        = ref<HTMLAudioElement|null>(null)
const playingId      = ref<number|null>(null)
const previewPlaying = ref(false)

function togglePlay(item: any) {
  const a = audioEl.value; if (!a) return
  if (playingId.value === item.id) { a.pause(); a.currentTime=0; playingId.value=null }
  else { a.src=item.url; a.play(); playingId.value=item.id; previewPlaying.value=false }
}
function togglePreview() {
  const a = audioEl.value; if (!a || !form.url) return
  if (previewPlaying.value) { a.pause(); a.currentTime=0; previewPlaying.value=false }
  else { a.src=form.url; a.play(); previewPlaying.value=true; playingId.value=null }
}

// ── 上传（列表行内） ──────────────────────────────────
const uploadingId = ref<number|null>(null)

async function uploadSound(event: Event, item: any) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  uploadingId.value = item.id
  try {
    const sign: any = await $fetch('/api/admin/sound/preset/upload-sign', {
      method:'POST', body:{ mimeType: file.type }, headers:authHeader()
    })
    await $fetch(sign.uploadUrl, { method:'PUT', body:file, headers:{ 'Content-Type': file.type } })
    await $fetch(`/api/admin/sound/preset/${item.id}`, { method:'PUT', body:{ url: sign.cdnUrl }, headers:authHeader() })
    item.url = sign.cdnUrl
    const a = audioEl.value; if(a){ a.src=sign.cdnUrl; a.play(); playingId.value=item.id }
  } catch(err:any) { alert('上传失败：' + (err?.message ?? '')) }
  finally { uploadingId.value=null; (event.target as HTMLInputElement).value='' }
}

// ── 弹窗表单 ──────────────────────────────────────────
const modal         = reactive({ show:false, isEdit:false, editId:null as number|null })
const saving        = ref(false)
const modalUploading = ref(false)
const form          = reactive({ emotion:'', name:'', url:'', sortOrder:0, status:1 })

function openAdd() {
  form.emotion=''; form.name=''; form.url=''; form.sortOrder=0; form.status=1
  modal.isEdit=false; modal.editId=null; modal.show=true
}
function openEdit(item: any) {
  form.emotion=item.emotion||''; form.name=item.name; form.url=item.url
  form.sortOrder=item.sort_order??0; form.status=item.status
  modal.isEdit=true; modal.editId=item.id; modal.show=true
}
function closeModal() {
  const a=audioEl.value; if(a){a.pause();a.currentTime=0}
  previewPlaying.value=false; modal.show=false
}

async function uploadInModal(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  modalUploading.value = true
  try {
    const sign: any = await $fetch('/api/admin/sound/preset/upload-sign', {
      method:'POST', body:{ mimeType: file.type }, headers:authHeader()
    })
    await $fetch(sign.uploadUrl, { method:'PUT', body:file, headers:{ 'Content-Type': file.type } })
    form.url = sign.cdnUrl
    const a = audioEl.value; if(a){ a.src=sign.cdnUrl; a.play(); previewPlaying.value=true }
  } catch(err:any) { alert('上传失败：' + (err?.message ?? err)) }
  finally { modalUploading.value=false; (event.target as HTMLInputElement).value='' }
}

async function save() {
  if (!form.name.trim()) { alert('请填写声音名称'); return }
  if (!form.url.trim())  { alert('请填写或上传声音 URL'); return }
  saving.value = true
  try {
    const payload = {
      petType: activePetType.value,
      emotion: form.emotion.trim() || null,
      name: form.name.trim(),
      url: form.url.trim(),
      sortOrder: form.sortOrder,
      status: form.status,
    }
    if (modal.isEdit && modal.editId) {
      await $fetch(`/api/admin/sound/preset/${modal.editId}`, { method:'PUT', body:payload, headers:authHeader() })
    } else {
      await $fetch('/api/admin/sound/preset/create', { method:'POST', body:payload, headers:authHeader() })
    }
    closeModal(); await loadData(); await loadCounts()
  } finally { saving.value=false }
}
</script>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all 0.2s ease}
.modal-enter-from,.modal-leave-to{opacity:0;transform:scale(0.96)}
</style>
