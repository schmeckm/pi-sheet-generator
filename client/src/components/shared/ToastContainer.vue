<template>
  <div class="fixed right-4 top-16 z-50 flex flex-col gap-2">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg"
      :class="{
        'bg-green-600': t.type === 'success',
        'bg-red-600': t.type === 'error',
        'bg-amber-600': t.type === 'warning',
        'bg-gray-800': t.type === 'info',
      }"
    >
      {{ t.message }}
    </div>
  </div>
</template>

<script setup>
import { useToast } from '@/composables/useToast';

const { toasts } = useToast();
</script>
