<template>
  <div class="rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md" :class="borderClass">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-wider text-gray-500">{{ label }}</p>
        <p class="mt-1 text-2xl font-bold" :class="valueClass">{{ displayValue }}</p>
        <p v-if="subtitle" class="mt-0.5 text-xs text-gray-400">{{ subtitle }}</p>
      </div>
      <div class="flex h-10 w-10 items-center justify-center rounded-lg" :class="iconBgClass">
        <span class="text-lg" aria-hidden="true">{{ icon }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: 0 },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '📊' },
  variant: { type: String, default: 'default' },
});

const VARIANTS = {
  default: { border: '', value: 'text-gray-900', iconBg: 'bg-gray-100' },
  success: { border: 'border-l-4 border-l-green-500', value: 'text-green-700', iconBg: 'bg-green-50' },
  warning: { border: 'border-l-4 border-l-amber-500', value: 'text-amber-700', iconBg: 'bg-amber-50' },
  info: { border: 'border-l-4 border-l-blue-500', value: 'text-blue-700', iconBg: 'bg-blue-50' },
  error: { border: 'border-l-4 border-l-red-500', value: 'text-red-700', iconBg: 'bg-red-50' },
};

const v = computed(() => VARIANTS[props.variant] || VARIANTS.default);
const borderClass = computed(() => v.value.border);
const valueClass = computed(() => v.value.value);
const iconBgClass = computed(() => v.value.iconBg);
const displayValue = computed(() =>
  typeof props.value === 'number' ? props.value.toLocaleString() : props.value
);
</script>
