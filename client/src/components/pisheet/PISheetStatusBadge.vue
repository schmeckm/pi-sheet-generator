<template>
  <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold" :class="badgeClass">
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  status: { type: String, default: 'draft' },
});

const { t } = useI18n();

const normalized = computed(() => {
  const s = props.status || 'draft';
  return s === 'review' ? 'in_review' : s;
});

const label = computed(() => t(`lifecycle.status.${normalized.value}`));

const badgeClass = computed(() => {
  const map = {
    draft: 'bg-gray-200 text-gray-800',
    in_review: 'bg-amber-100 text-amber-900',
    approved: 'bg-green-100 text-green-900',
    archived: 'bg-slate-200 text-slate-700',
  };
  return map[normalized.value] || map.draft;
});
</script>
