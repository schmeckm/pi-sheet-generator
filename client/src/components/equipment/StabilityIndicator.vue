<template>
  <span
    class="inline-block min-w-[5.5rem] text-center text-[10px] font-bold uppercase tracking-wider"
    :class="stable ? 'text-green-400' : 'text-yellow-400'"
  >
    {{ stable ? t('equipment.stable') : t('equipment.unstable') }}
  </span>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({ stable: { type: Boolean, default: false } });
const { t } = useI18n();
</script>
