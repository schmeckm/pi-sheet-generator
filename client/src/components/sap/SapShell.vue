<template>
  <div class="sap-shell sap-shell--joule">
    <SapShellBar
      :title="shellTitle"
      :subtitle="shellSubtitle"
      :show-nav="!isAdminLayout"
    >
      <template v-if="!isAdminLayout" #leading>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-touch-target !text-xs md:!hidden"
          :aria-label="t('common.menu')"
          @click="shell.primaryNavOpen = !shell.primaryNavOpen"
        >
          {{ t('common.menu') }}
        </button>
      </template>
      <template v-if="isAdminLayout" #actions>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-touch-target !text-xs lg:!hidden"
          @click="shell.adminNavOpen = !shell.adminNavOpen"
        >
          {{ t('common.menu') }}
        </button>
      </template>
      <template v-if="isChat" #actions>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-shell-icon-btn lg:!hidden"
          :title="t('joule.newChat')"
          :aria-label="t('joule.newChat')"
          @click="startNewChat"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-shell-icon-btn lg:!hidden"
          :class="shell.chatHistoryOpen ? 'sap-joule-shell-btn--active !border' : ''"
          :title="t('joule.history')"
          :aria-label="t('joule.history')"
          @click="shell.toggleChatHistory()"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-shell-icon-btn lg:!hidden"
          :title="t('joule.piSheet')"
          :aria-label="t('joule.piSheet')"
          @click="shell.toggleChatPreview()"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-joule-shell-action !text-xs hidden lg:inline-flex"
          :title="t('joule.newChat')"
          @click="startNewChat"
        >
          {{ t('joule.newChat') }}
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent sap-joule-shell-action !text-xs hidden lg:inline-flex"
          :class="shell.chatHistoryOpen ? 'sap-joule-shell-btn--active !border' : ''"
          @click="shell.toggleChatHistory()"
        >
          {{ t('joule.history') }}
        </button>
      </template>
    </SapShellBar>

    <div class="sap-shell-body">
      <div
        v-if="!isAdminLayout && shell.primaryNavOpen"
        class="fixed inset-0 z-20 bg-black/30 md:hidden"
        @click="shell.closePrimaryNav()"
      />
      <PrimaryNavDrawer
        v-if="!isAdminLayout"
        :class="[
          'md:hidden',
          shell.primaryNavOpen
            ? 'fixed top-[var(--sapShell_Height)] bottom-[var(--sapFooter_Height)] left-0 z-30'
            : 'hidden',
        ]"
      />

      <div
        v-if="isAdminLayout && shell.adminNavOpen"
        class="fixed inset-0 z-20 bg-black/30 lg:hidden"
        @click="shell.adminNavOpen = false"
      />
      <SapSideNavigation
        v-if="isAdminLayout"
        :class="[
          'lg:relative lg:translate-x-0',
          shell.adminNavOpen
            ? 'fixed top-[var(--sapShell_Height)] bottom-[var(--sapFooter_Height)] left-0 z-30 shadow-lg'
            : 'hidden lg:flex',
        ]"
      />
      <main class="sap-shell-main">
        <div class="sap-shell-content" :class="contentClass">
          <slot />
        </div>
      </main>
    </div>

    <div class="sap-shell-footer">
      <ProtocolStatusBar v-if="auth.isAuthenticated" />
      <SapStatusBar v-if="auth.isAuthenticated" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import SapShellBar from './SapShellBar.vue';
import SapSideNavigation from './SapSideNavigation.vue';
import SapStatusBar from './SapStatusBar.vue';
import ProtocolStatusBar from './ProtocolStatusBar.vue';
import PrimaryNavDrawer from './PrimaryNavDrawer.vue';
import { useShellStore } from '@/stores/shell';
import { useAuthStore } from '@/stores/auth';
import { useNewChat } from '@/composables/useNewChat';

const { t } = useI18n();
const shell = useShellStore();
const auth = useAuthStore();
const { startNewChat } = useNewChat();
const route = useRoute();

const isAdminLayout = computed(() => route.meta.layout === 'admin');
const isChat = computed(() => route.name === 'chat');

const shellTitle = computed(() => {
  if (isChat.value) return t('joule.title');
  if (isAdminLayout.value) {
    return auth.isAdmin ? t('shell.adminArea') : t('shell.promptArea');
  }
  return t('common.appName');
});

const shellSubtitle = computed(() => {
  if (isChat.value) return t('joule.subtitle');
  if (isAdminLayout.value) {
    return auth.isAdmin ? t('shell.adminSubtitle') : t('shell.promptSubtitle');
  }
  return '';
});

const contentClass = computed(() =>
  isChat.value ? 'sap-shell-content--flush' : 'sap-shell-content--padded'
);

watch(
  () => route.fullPath,
  () => {
    shell.closePrimaryNav();
    shell.closeAdminNav();
  }
);
</script>
