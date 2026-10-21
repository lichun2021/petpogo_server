<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0"><AdminPageTitle>{{ title }}</AdminPageTitle><p v-if="description" class="mt-1.5 text-sm text-stone-500">{{ description }}</p></div>
    <div class="flex flex-wrap items-center gap-3"><span v-if="count !== undefined" class="text-sm text-stone-500">共 <strong class="font-semibold text-stone-800">{{ count }}</strong> {{ unit }}</span><slot /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title: string; description?: string; count?: number; unit?: string }>()
</script>
