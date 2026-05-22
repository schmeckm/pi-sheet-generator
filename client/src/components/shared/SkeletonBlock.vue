<template>
  <div class="animate-pulse" :class="wrapperClass">
    <div
      v-for="i in lines"
      :key="i"
      class="rounded bg-gray-200"
      :class="[lineClass, i === lines ? '' : 'mb-2']"
      :style="{ width: i === lines && widthLast ? widthLast : width, height }"
    />
  </div>
</template>

<script setup>
defineProps({
  lines: { type: Number, default: 3 },
  height: { type: String, default: '0.75rem' },
  width: { type: String, default: '100%' },
  widthLast: { type: String, default: '70%' },
  wrapperClass: { type: String, default: '' },
  lineClass: { type: String, default: '' },
});
</script>
