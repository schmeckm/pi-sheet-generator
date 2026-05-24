<template>
  <div class="mx-auto max-w-4xl py-16 text-center">
    <div class="mb-4 text-5xl">{{ icon }}</div>
    <h1 class="text-2xl font-bold text-gray-900">{{ title }}</h1>
    <p class="mt-2 text-gray-500">{{ t('xstepAgent.comingSoon') }}</p>
    <router-link
      to="/xstep-agent/dashboard"
      class="mt-6 inline-block rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {{ t('xstepAgent.backToDashboard') }}
    </router-link>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: '🚧' },
});
</script>
