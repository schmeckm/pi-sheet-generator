<template>
  <nav class="sap-side-nav" aria-label="Admin navigation">
    <p class="sap-side-nav__group-title">{{ t('shell.adminArea') }}</p>
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="sap-side-nav__item"
      active-class="sap-side-nav__item--active"
      @click="shell.closeAdminNav()"
    >
      <component :is="item.icon" class="sap-side-nav__icon" />
      <span>{{ item.label }}</span>
    </router-link>
    <div class="mt-auto border-t border-[var(--sapNeutralBorderColor)] p-3">
      <router-link to="/chat" class="sap-btn sap-btn--transparent w-full !text-sm">
        {{ t('shell.backToCopilot') }}
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShellStore } from '@/stores/shell';

const { t } = useI18n();
const shell = useShellStore();

const icon = (paths) => ({
  render: () =>
    h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: paths,
      }),
    ]),
});

const items = computed(() => [
  {
    to: '/admin',
    label: t('nav.dashboard'),
    icon: icon('M4 6h16M4 12h16M4 18h16'),
  },
  {
    to: '/admin/pi-sheets',
    label: t('nav.piSheets'),
    icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
  },
  {
    to: '/admin/audit',
    label: t('nav.audit'),
    icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'),
  },
  {
    to: '/admin/process-graph',
    label: t('nav.processGraph'),
    icon: icon('M13 10V3L4 14h7v7l9-11h-7z'),
  },
  {
    to: '/admin/repository',
    label: t('nav.repository'),
    icon: icon('M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7l8-4 8 4'),
  },
  {
    to: '/admin/upload',
    label: t('nav.upload'),
    icon: icon('M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4'),
  },
  {
    to: '/admin/knowledge',
    label: t('nav.knowledge'),
    icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'),
  },
  {
    to: '/admin/equipment',
    label: t('nav.equipment'),
    icon: icon('M3 6h18M8 6V4h8v2m-9 4h10m-12 8h14a2 2 0 002-2V8H5v12a2 2 0 002 2z'),
  },
  {
    to: '/admin/settings',
    label: t('nav.settings'),
    icon: icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'),
  },
  {
    to: '/admin/prompts',
    label: t('nav.promptConfig'),
    icon: icon('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'),
  },
  {
    to: '/admin/help',
    label: t('nav.help'),
    icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
]);
</script>
