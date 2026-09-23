<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center" role="status">
    <div class="size-12 rounded-xl bg-stone-50 flex items-center justify-center"><UIcon :name="icon" class="size-6 text-stone-500" /></div>
    <div><p class="text-sm font-medium text-stone-700">{{ title }}</p><p v-if="description" class="mt-1 text-xs text-stone-500">{{ description }}</p></div>
    <slot />
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), { icon: 'i-heroicons-inbox' })
</script>
