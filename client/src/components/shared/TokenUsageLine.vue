<template>
  <p
    v-if="usage && usage.total_tokens"
    class="token-usage text-[10px] tabular-nums text-[var(--sapContentLabelColor)]"
    :class="compact ? '' : 'mt-1'"
  >
    <span class="font-medium text-[var(--sapTextColor)]">{{ t('common.tokenUsage') }}:</span>
    {{ t('common.tokenUsageDetail', formatted) }}
  </p>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  usage: { type: Object, default: null },
  compact: { type: Boolean, default: false },
});

const { t } = useI18n();

const formatted = computed(() => {
  const u = props.usage;
  if (!u) return { input: '0', output: '0', total: '0' };
  const fmt = (n) => Number(n || 0).toLocaleString();
  return {
    input: fmt(u.input_tokens),
    output: fmt(u.output_tokens),
    total: fmt(u.total_tokens ?? (u.input_tokens || 0) + (u.output_tokens || 0)),
  };
});
</script>
