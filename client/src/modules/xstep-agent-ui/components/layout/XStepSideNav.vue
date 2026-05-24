<template>
  <nav class="sap-side-nav" :aria-label="t('xstepAgent.navAria')">
    <p class="sap-side-nav__group-title">{{ t('xstepAgent.navTitle') }}</p>
    <router-link
      v-for="item in visibleItems"
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
      <router-link to="/admin" class="sap-btn sap-btn--transparent w-full !text-sm">
        {{ t('xstepAgent.backToAdmin') }}
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
    to: '/xstep-agent/dashboard',
    label: t('xstepAgent.navDashboard'),
    icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
    feature: null,
  },
  {
    to: '/xstep-agent/materials',
    label: t('xstepAgent.navMaterials'),
    icon: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
    feature: null,
  },
  {
    to: '/xstep-agent/recipes',
    label: t('xstepAgent.navRecipes'),
    icon: icon('M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'),
    feature: null,
  },
  {
    to: '/xstep-agent/xsteps',
    label: t('xstepAgent.navXSteps'),
    icon: icon('M4 6h16M4 10h16M4 14h16M4 18h16'),
    feature: null,
  },
  {
    to: '/xstep-agent/sops',
    label: t('xstepAgent.navSops'),
    icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'),
    feature: null,
  },
  {
    to: '/xstep-agent/import',
    label: t('xstepAgent.navImport'),
    icon: icon('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'),
    feature: null,
  },
  {
    to: '/xstep-agent/composer',
    label: t('xstepAgent.navComposer'),
    icon: icon('M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'),
    feature: 'XSTEP_AGENT_COMPOSER_ENABLED',
  },
  {
    to: '/xstep-agent/review',
    label: t('xstepAgent.navReview'),
    icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
    feature: 'XSTEP_AGENT_REVIEW_ENABLED',
  },
  {
    to: '/xstep-agent/retrieval-debugger',
    label: t('xstepAgent.navRetrievalDebugger'),
    icon: icon('M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'),
    feature: 'XSTEP_AGENT_RETRIEVAL_DEBUGGER_ENABLED',
  },
  {
    to: '/xstep-agent/knowledge-graph',
    label: t('xstepAgent.navKnowledgeGraph'),
    icon: icon('M13 10V3L4 14h7v7l9-11h-7z'),
    feature: 'XSTEP_AGENT_GRAPH_ENABLED',
  },
  {
    to: '/xstep-agent/audit',
    label: t('xstepAgent.navAudit'),
    icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'),
    feature: null,
  },
  {
    to: '/xstep-agent/settings',
    label: t('xstepAgent.navSettings'),
    icon: icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'),
    feature: null,
  },
  {
    to: '/xstep-agent/help',
    label: t('xstepAgent.navHelp'),
    icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
    feature: null,
  },
]);

const visibleItems = computed(() =>
  items.value.filter((item) => !item.feature || true)
);
</script>
