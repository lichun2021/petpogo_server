<template>
  <div class="space-y-5">

    <!-- 顶部操作栏 -->
    <div class="flex items-center gap-3">
      <h2 class="text-base font-bold text-stone-800 flex items-center gap-2">
        <UIcon name="i-heroicons-musical-note" class="w-5 h-5 text-amber-500" />
        宠物音乐管理
      </h2>
      <div class="ml-auto flex gap-2">
        <UButton
          label="新建分类"
          icon="i-heroicons-tag"
          color="stone"
          variant="outline"
          size="sm"
          @click="openCatModal()"
        />
        <UButton
          label="上传音乐"
          icon="i-heroicons-plus"
          color="amber"
          size="sm"
          :disabled="!categories.length"
          @click="openMusicModal()"
        />
      </div>
    </div>

    <!-- 分类选项卡 -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
          activeCatId === null
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #f0e6d8"
        @click="activeCatId = null; loadMusic()"
      >全部</button>
      <button
        v-for="c in categories" :key="c.id"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
          activeCatId === c.id
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #f0e6d8"
        @click="activeCatId = c.id; loadMusic()"
      >
        <img v-if="c.icon_url" :src="c.icon_url" class="w-4 h-4 rounded object-cover" />
        <UIcon v-else name="i-heroicons-tag" class="w-3.5 h-3.5 opacity-60" />
        {{ c.name }}
        <!-- 删除分类按钮 -->
        <span
          class="ml-0.5 text-white/70 hover:text-red-200 leading-none"
          title="删除分类"
          @click.stop="deleteCat(c)"
        >×</span>
      </button>
      <span class="ml-auto text-xs text-stone-400">共 {{ musicList.length }} 首</span>
    </div>

    <!-- 音乐列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!musicList.length" class="py-10 text-center text-sm text-stone-400">
        暂无音乐，点击「上传音乐」添加
      </div>
      <div v-else>
        <!-- 表头 -->
        <div class="grid grid-cols-[56px_1fr_100px_80px_80px_80px_80px] gap-3 px-4 py-2 bg-amber-50/50 border-b border-orange-100 text-xs text-stone-500 font-medium">
          <span>封面</span>
          <span>音乐名称</span>
          <span>分类</span>
          <span>宠物</span>
          <span>时长</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        <!-- 行 -->
        <div
          v-for="m in musicList" :key="m.id"
          class="grid grid-cols-[56px_1fr_100px_80px_80px_80px_80px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-amber-50/20 transition-colors items-center"
        >
          <!-- 封面 -->
          <div class="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 flex items-center justify-center">
            <img v-if="m.icon_url" :src="m.icon_url" class="w-full h-full object-cover" />
            <UIcon v-else name="i-heroicons-musical-note" class="w-5 h-5 text-stone-300" />
          </div>
          <!-- 名称 + 播放链接 -->
          <div class="min-w-0">
            <p class="text-sm text-stone-700 font-medium truncate">{{ m.name }}</p>
            <a :href="m.music_url" target="_blank" class="text-xs text-amber-500 hover:underline truncate block">
              点击试听 ↗
            </a>
          </div>
          <!-- 分类 -->
          <span class="text-xs text-stone-500 bg-amber-50 px-2 py-0.5 rounded-full w-fit">{{ m.category_name }}</span>
          <!-- 宠物类型 -->
          <span :class="petTypeCls(m.pet_type)" class="text-xs px-2 py-0.5 rounded-full w-fit font-medium">
            {{ petTypeLabel(m.pet_type) }}
          </span>
          <!-- 时长 -->
          <span class="text-xs text-stone-400">{{ m.duration ? formatDuration(m.duration) : '-' }}</span>
          <!-- 状态 -->
          <UBadge :label="m.status === 1 ? '上架' : '下架'" :color="m.status === 1 ? 'green' : 'gray'" variant="subtle" size="xs" />
          <!-- 操作 -->
          <UButton
            icon="i-heroicons-trash"
            color="red"
            variant="ghost"
            size="xs"
            :loading="m._deleting"
            @click="deleteMusic(m)"
          />
        </div>
      </div>
    </div>

    <!-- ── 新建分类弹窗 ─────────────────────── -->
    <div v-if="catModal.show"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.4)"
      @click.self="catModal.show = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">新建音乐分类</h3>

        <div class="space-y-3">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">分类名称 *</label>
            <UInput v-model="catModal.name" placeholder="如：助眠、安抚、平静…" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">分类图标</label>
            <!-- 图标上传 -->
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden border border-dashed border-stone-300">
                <img v-if="catModal.iconPreview" :src="catModal.iconPreview" class="w-full h-full object-cover" />
                <UIcon v-else name="i-heroicons-photo" class="w-6 h-6 text-stone-300" />
              </div>
              <div class="flex-1">
                <input ref="catIconInput" type="file" accept="image/*" class="hidden" @change="onCatIconPick" />
                <UButton
                  label="选择图片"
                  icon="i-heroicons-arrow-up-tray"
                  color="stone"
                  variant="outline"
                  size="sm"
                  :loading="catModal.uploading"
                  @click="catIconInput?.click()"
                />
                <p class="text-xs text-stone-400 mt-1">支持 JPG / PNG / WebP</p>
              </div>
            </div>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">排序（越小越靠前）</label>
            <UInput v-model.number="catModal.sortOrder" type="number" placeholder="0" />
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="catModal.show = false" />
          <UButton
            label="创建分类"
            color="amber"
            class="flex-1"
            :loading="catModal.saving"
            :disabled="!catModal.name.trim()"
            @click="saveCat"
          />
        </div>
      </div>
    </div>

    <!-- ── 上传音乐弹窗 ─────────────────────── -->
    <div v-if="musicModal.show"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.4)"
      @click.self="musicModal.show = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-[440px] p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">上传音乐</h3>

        <div class="space-y-3">
          <!-- 分类 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">所属分类 *</label>
            <select
              v-model="musicModal.categoryId"
              class="w-full border rounded-lg px-3 py-2 text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              style="border-color: #e5e7eb"
            >
              <option value="" disabled>请选择分类</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <!-- 宠物类型 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">适用宠物 *</label>
            <div class="flex gap-2">
              <button
                v-for="pt in petTypeOpts" :key="pt.value"
                :class="[
                  'flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all',
                  musicModal.petType === pt.value
                    ? pt.activeCls
                    : 'border-stone-200 text-stone-400 hover:border-stone-300'
                ]"
                @click="musicModal.petType = pt.value"
              >
                {{ pt.emoji }} {{ pt.label }}
              </button>
            </div>
          </div>

          <!-- 名称 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">音乐名称 *</label>
            <UInput v-model="musicModal.name" placeholder="输入音乐名称" />
          </div>

          <!-- 封面图 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">封面图 *</label>
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden border border-dashed border-stone-300">
                <img v-if="musicModal.iconPreview" :src="musicModal.iconPreview" class="w-full h-full object-cover" />
                <UIcon v-else name="i-heroicons-photo" class="w-6 h-6 text-stone-300" />
              </div>
              <div class="flex-1">
                <input ref="musicIconInput" type="file" accept="image/*" class="hidden" @change="onMusicIconPick" />
                <UButton
                  :label="musicModal.iconUrl ? '已上传 ✓' : '选择封面图'"
                  icon="i-heroicons-arrow-up-tray"
                  :color="musicModal.iconUrl ? 'green' : 'stone'"
                  variant="outline"
                  size="sm"
                  :loading="musicModal.iconUploading"
                  @click="musicIconInput?.click()"
                />
              </div>
            </div>
          </div>

          <!-- 音频文件 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">音频文件 *</label>
            <div class="flex items-center gap-3">
              <div class="flex-1 border rounded-lg px-3 py-2 text-xs text-stone-500 bg-stone-50 truncate" style="border-color: #e5e7eb">
                {{ musicModal.audioName || '未选择文件' }}
              </div>
              <input ref="musicAudioInput" type="file" accept="audio/*" class="hidden" @change="onAudioPick" />
              <UButton
                :label="musicModal.musicUrl ? '已上传 ✓' : '选择音频'"
                icon="i-heroicons-musical-note"
                :color="musicModal.musicUrl ? 'green' : 'stone'"
                variant="outline"
                size="sm"
                :loading="musicModal.audioUploading"
                @click="musicAudioInput?.click()"
              />
            </div>
            <p class="text-xs text-stone-400 mt-1">支持 MP3 / AAC / WAV / M4A，建议 5MB 以内</p>
          </div>

          <!-- 排序 -->
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">排序</label>
            <UInput v-model.number="musicModal.sortOrder" type="number" placeholder="0" />
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="musicModal.show = false" />
          <UButton
            label="保存音乐"
            color="amber"
            class="flex-1"
            :loading="musicModal.saving"
            :disabled="!musicModal.name || !musicModal.categoryId || !musicModal.iconUrl || !musicModal.musicUrl"
            @click="saveMusic"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminMusic' })
definePageMeta({ layout: 'admin' })

const toast = useToast()

// ── 数据 ──────────────────────────────────────────────────
const categories = ref<any[]>([])
const musicList  = ref<any[]>([])
const loading    = ref(false)
const activeCatId = ref<number | null>(null)

// ── 文件输入引用 ──────────────────────────────────────────
const catIconInput   = ref<HTMLInputElement | null>(null)
const musicIconInput = ref<HTMLInputElement | null>(null)
const musicAudioInput = ref<HTMLInputElement | null>(null)

// ── 分类弹窗 ──────────────────────────────────────────────
const catModal = reactive({
  show:      false,
  name:      '',
  iconUrl:   '',
  iconPreview: '',
  sortOrder: 0,
  uploading: false,
  saving:    false,
})

// ── 宠物类型配置 ───────────────────────────────────────────
const petTypeOpts = [
  { value: 'all', label: '通用',  emoji: '🐾', activeCls: 'border-stone-500 bg-stone-50 text-stone-700' },
  { value: 'cat', label: '猫咪',  emoji: '🐱', activeCls: 'border-orange-400 bg-orange-50 text-orange-700' },
  { value: 'dog', label: '狗狗',  emoji: '🐶', activeCls: 'border-amber-400 bg-amber-50 text-amber-700' },
]

function petTypeLabel(v: string) {
  return ({ all: '🐾 通用', cat: '🐱 猫', dog: '🐶 狗' } as any)[v] ?? v
}
function petTypeCls(v: string) {
  return ({
    all: 'bg-stone-100 text-stone-500',
    cat: 'bg-orange-100 text-orange-600',
    dog: 'bg-amber-100 text-amber-600',
  } as any)[v] ?? 'bg-stone-100 text-stone-500'
}

// ── 音乐弹窗 ──────────────────────────────────────────────
const musicModal = reactive({
  show:          false,
  categoryId:    '' as number | '',
  petType:       'all',
  name:          '',
  iconUrl:       '',
  iconPreview:   '',
  musicUrl:      '',
  audioName:     '',
  duration:      0,
  sortOrder:     0,
  iconUploading:  false,
  audioUploading: false,
  saving:        false,
})

// ── 加载 ──────────────────────────────────────────────────
async function loadCategories() {
  const d = await $fetch<any>('/api/admin/music/categories')
  categories.value = d.list
}

async function loadMusic() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/music', {
      query: activeCatId.value != null ? { categoryId: activeCatId.value } : {}
    })
    musicList.value = d.list
  } finally { loading.value = false }
}

// ── OSS 上传工具 ───────────────────────────────────────────
async function uploadToOss(file: File, folder: 'music' | 'music-icon'): Promise<string> {
  // 1. 向后端申请预签名 URL
  const sign = await $fetch<any>('/api/admin/music/upload-sign', {
    method: 'POST',
    body: { mimeType: file.type, folder },
  })
  // 2. PUT 直传 OSS
  await $fetch(sign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  return sign.cdnUrl
}

// ── 分类图标选择 ───────────────────────────────────────────
async function onCatIconPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  catModal.uploading = true
  try {
    catModal.iconPreview = URL.createObjectURL(file)
    catModal.iconUrl = await uploadToOss(file, 'music-icon')
  } catch {
    toast.add({ title: '图片上传失败', color: 'red' })
  } finally { catModal.uploading = false }
}

function openCatModal() {
  Object.assign(catModal, { show: true, name: '', iconUrl: '', iconPreview: '', sortOrder: 0 })
}

async function saveCat() {
  if (!catModal.name.trim()) return
  catModal.saving = true
  try {
    await $fetch('/api/admin/music/categories', {
      method: 'POST',
      body: { name: catModal.name.trim(), icon_url: catModal.iconUrl, sort_order: catModal.sortOrder },
    })
    catModal.show = false
    toast.add({ title: `分类「${catModal.name}」已创建`, color: 'green' })
    await loadCategories()
  } catch (err: any) {
    toast.add({ title: err?.data?.message || '创建失败', color: 'red' })
  } finally { catModal.saving = false }
}

async function deleteCat(c: any) {
  if (!confirm(`确定删除分类「${c.name}」？\n删除前请确保该分类下没有音乐。`)) return
  try {
    await $fetch(`/api/admin/music/categories/${c.id}`, { method: 'DELETE' })
    toast.add({ title: '分类已删除', color: 'green' })
    if (activeCatId.value === c.id) activeCatId.value = null
    await loadCategories()
    await loadMusic()
  } catch (err: any) {
    toast.add({ title: err?.data?.message || '删除失败', color: 'red' })
  }
}

// ── 音乐弹窗 ──────────────────────────────────────────────
function openMusicModal() {
  Object.assign(musicModal, {
    show: true, categoryId: activeCatId.value || '', petType: 'all',
    name: '', iconUrl: '', iconPreview: '', musicUrl: '',
    audioName: '', duration: 0, sortOrder: 0,
  })
}

async function onMusicIconPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  musicModal.iconUploading = true
  try {
    musicModal.iconPreview = URL.createObjectURL(file)
    musicModal.iconUrl = await uploadToOss(file, 'music-icon')
  } catch {
    toast.add({ title: '封面图上传失败', color: 'red' })
  } finally { musicModal.iconUploading = false }
}

async function onAudioPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  musicModal.audioName      = file.name
  musicModal.audioUploading = true
  try {
    musicModal.musicUrl = await uploadToOss(file, 'music')
    // 尝试读取音频时长
    const audio = new Audio(URL.createObjectURL(file))
    audio.onloadedmetadata = () => { musicModal.duration = Math.round(audio.duration) }
    toast.add({ title: '音频上传成功', color: 'green' })
  } catch {
    toast.add({ title: '音频上传失败', color: 'red' })
  } finally { musicModal.audioUploading = false }
}

async function saveMusic() {
  musicModal.saving = true
  try {
    await $fetch('/api/admin/music', {
      method: 'POST',
      body: {
        category_id: musicModal.categoryId,
        pet_type:    musicModal.petType,
        name:        musicModal.name,
        icon_url:    musicModal.iconUrl,
        music_url:   musicModal.musicUrl,
        duration:    musicModal.duration,
        sort_order:  musicModal.sortOrder,
      },
    })
    musicModal.show = false
    toast.add({ title: `「${musicModal.name}」已上传`, color: 'green' })
    await loadMusic()
  } catch (err: any) {
    toast.add({ title: err?.data?.message || '保存失败', color: 'red' })
  } finally { musicModal.saving = false }
}

async function deleteMusic(m: any) {
  if (!confirm(`确定删除「${m.name}」？`)) return
  m._deleting = true
  try {
    await $fetch(`/api/admin/music/${m.id}`, { method: 'DELETE' })
    musicList.value = musicList.value.filter(x => x.id !== m.id)
    toast.add({ title: '已删除', color: 'green' })
  } catch {
    toast.add({ title: '删除失败', color: 'red' })
  } finally { m._deleting = false }
}

// ── 工具 ──────────────────────────────────────────────────
function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

onMounted(async () => {
  await loadCategories()
  await loadMusic()
})
</script>
