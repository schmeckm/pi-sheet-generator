<template>
  <aside class="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
    <nav class="flex flex-col gap-1">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        active-class="bg-gray-900 text-white hover:bg-gray-900"
      >
        {{ item.label }}
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const items = computed(() => [
  { to: '/admin', label: t('nav.dashboard') },
  { to: '/admin/repository', label: t('nav.repository') },
  { to: '/admin/upload', label: t('nav.upload') },
  { to: '/admin/knowledge', label: t('nav.knowledge') },
  { to: '/admin/equipment', label: t('nav.equipment') },
  { to: '/admin/settings', label: t('nav.settings') },
  { to: '/admin/prompts', label: t('nav.promptConfig') },
  { to: '/admin/help', label: t('nav.help') },
]);
</script>
