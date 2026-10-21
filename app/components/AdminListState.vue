<template>
  <div v-if="loading && !hasData" class="flex items-center justify-center gap-2 py-16 text-sm text-stone-500" role="status"><UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />正在加载…</div>
  <div v-else-if="error" :class="hasData ? 'mx-4 my-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3' : 'px-6 py-12 text-center'" role="alert">
    <p class="text-sm font-medium text-stone-800">{{ error }}</p>
    <p v-if="hasData" class="mt-1 text-xs text-stone-600">当前显示上次成功加载的数据。</p>
    <p v-if="requestId" class="mt-1 break-all font-mono text-xs text-stone-500">请求编号：{{ requestId }}</p>
    <UButton label="重新加载" color="neutral" variant="outline" size="sm" class="mt-3" :loading="loading" @click="$emit('retry')" />
  </div>
  <AdminEmptyState v-else-if="empty && !hasData" :title="filtered ? '没有符合条件的结果' : emptyTitle" :description="filtered ? '调整筛选条件后再试' : emptyDescription" :icon="icon"><UButton v-if="filtered" label="清除筛选" color="neutral" variant="outline" @click="$emit('reset')" /></AdminEmptyState>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ loading: boolean; hasData: boolean; empty: boolean; error?: string; requestId?: string; filtered?: boolean; emptyTitle?: string; emptyDescription?: string; icon?: string }>(), { emptyTitle: '暂无数据', icon: 'i-heroicons-inbox' })
defineEmits<{ retry: []; reset: [] }>()
</script>
