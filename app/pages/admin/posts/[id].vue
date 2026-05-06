<template>
  <div class="space-y-5">
    <!-- 返回 + 操作栏 -->
    <div class="flex items-center gap-3">
      <UButton icon="i-heroicons-arrow-left" color="gray" variant="ghost" @click="$router.back()" />
      <h2 class="text-base font-semibold text-stone-700 flex-1">帖子详情</h2>
      <UBadge
        :label="statusLabel"
        :color="statusColor"
        variant="subtle"
      />
      <UButton v-if="post?.status !== 1" label="通过" color="green" size="sm" :loading="acting" @click="setStatus(1)" />
      <UButton v-if="post?.status !== 3" label="标记违规" color="red"   size="sm" variant="outline" :loading="acting" @click="setStatus(3)" />
      <UButton label="删除帖子" color="red" variant="ghost" size="sm" :loading="deleting" @click="deletePost" />
    </div>

    <div v-if="pending" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-stone-400 animate-spin" />
    </div>

    <template v-else-if="post">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- 左：内容预览 -->
        <div class="lg:col-span-2 space-y-4">
          <!-- 发帖人 -->
          <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color:#f0e6d8">
            <UAvatar :src="post.user_avatar" :alt="post.nickname" size="md" />
            <div>
              <p class="font-medium text-stone-800">{{ post.nickname }}</p>
              <p class="text-xs text-stone-400">{{ post.phone }} · {{ formatDate(post.created_at) }}</p>
            </div>
            <UBadge
              :label="post.media_type === 0 ? '文字' : post.media_type === 1 ? '图片' : '视频'"
              :color="post.media_type === 0 ? 'gray' : post.media_type === 1 ? 'blue' : 'purple'"
              variant="subtle" size="xs" class="ml-auto"
            />
          </div>

          <!-- 正文 -->
          <div class="bg-white rounded-2xl border p-4" style="border-color:#f0e6d8">
            <p class="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">{{ post.content || '（无文字内容）' }}</p>
          </div>

          <!-- 图片 -->
          <div v-if="post.media_urls?.length" class="bg-white rounded-2xl border p-4" style="border-color:#f0e6d8">
            <p class="text-xs text-stone-400 mb-3">图片 ({{ post.media_urls.length }})</p>
            <div class="grid grid-cols-3 gap-2">
              <a v-for="(url, i) in post.media_urls" :key="i" :href="url" target="_blank">
                <img :src="url" class="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity" />
              </a>
            </div>
          </div>

          <!-- 视频 -->
          <div v-if="post.video_url" class="bg-white rounded-2xl border p-4" style="border-color:#f0e6d8">
            <p class="text-xs text-stone-400 mb-3">视频</p>
            <div class="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video
                :src="post.video_url"
                :poster="post.cover_url"
                controls
                class="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <!-- 右：数据 + 评论 -->
        <div class="space-y-4">
          <!-- 数据统计 -->
          <div class="bg-white rounded-2xl border p-4" style="border-color:#f0e6d8">
            <p class="text-xs text-stone-400 mb-3 font-medium">数据统计</p>
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <p class="text-xl font-bold text-amber-600">{{ post.like_count }}</p>
                <p class="text-xs text-stone-400 mt-0.5">点赞</p>
              </div>
              <div>
                <p class="text-xl font-bold text-amber-600">{{ post.comment_count }}</p>
                <p class="text-xs text-stone-400 mt-0.5">评论</p>
              </div>
              <div>
                <p class="text-xl font-bold text-amber-600">{{ post.view_count }}</p>
                <p class="text-xs text-stone-400 mt-0.5">浏览</p>
              </div>
            </div>
          </div>

          <!-- 评论列表 -->
          <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:#f0e6d8">
            <div class="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p class="text-sm font-medium text-stone-700">评论 ({{ post.comments?.length || 0 }})</p>
            </div>
            <div v-if="!post.comments?.length" class="py-8 text-center text-sm text-stone-400">暂无评论</div>
            <div v-else class="divide-y divide-stone-100 max-h-[560px] overflow-y-auto">
              <div
                v-for="c in post.comments" :key="c.id"
                class="px-4 py-3 flex gap-3"
                :class="c.deleted ? 'opacity-40' : ''"
              >
                <UAvatar :src="c.user_avatar" :alt="c.nickname" size="xs" class="flex-shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <span class="text-xs font-medium text-stone-700">{{ c.nickname }}</span>
                    <span class="text-xs text-stone-300">·</span>
                    <span class="text-xs text-stone-400">{{ formatDate(c.created_at) }}</span>
                    <UBadge v-if="c.deleted" label="已删除" color="red" variant="subtle" size="xs" class="ml-1" />
                  </div>
                  <p class="text-sm text-stone-600 break-words">{{ c.content }}</p>
                </div>
                <UButton
                  v-if="!c.deleted"
                  icon="i-heroicons-trash"
                  color="red" variant="ghost" size="xs"
                  :loading="c._deleting"
                  @click="deleteComment(c)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route  = useRoute()
const toast  = useToast()
const acting = ref(false)
const deleting = ref(false)

const { data: post, pending, refresh } = await useFetch<any>(`/api/admin/posts/${route.params.id}`)

const statusLabel = computed(() => {
  if (!post.value) return ''
  return { 1: '已通过', 2: '待审核', 3: '已违规' }[post.value.status as 1|2|3] || ''
})
const statusColor = computed(() => {
  return { 1: 'green', 2: 'yellow', 3: 'red' }[post.value?.status as 1|2|3] || 'gray'
})

async function setStatus(status: number) {
  acting.value = true
  try {
    await $fetch(`/api/admin/posts/${route.params.id}/status`, { method: 'PUT', body: { status } })
    if (post.value) post.value.status = status
    toast.add({ title: status === 1 ? '已通过' : '已标记违规', color: status === 1 ? 'green' : 'red' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { acting.value = false }
}

async function deletePost() {
  if (!confirm('确定要删除这条帖子吗？')) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/posts/${route.params.id}/status`, { method: 'PUT', body: { status: 3 } })
    toast.add({ title: '已删除', color: 'green' })
    navigateTo('/admin/posts')
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { deleting.value = false }
}

async function deleteComment(c: any) {
  c._deleting = true
  try {
    await $fetch(`/api/admin/comments/${c.id}`, { method: 'DELETE' })
    c.deleted = true
    if (post.value) post.value.comment_count = Math.max(0, post.value.comment_count - 1)
    toast.add({ title: '评论已删除', color: 'green' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { c._deleting = false }
}

function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>
