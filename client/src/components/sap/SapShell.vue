<template>
  <div class="sap-shell">
    <SapShellBar
      :title="shellTitle"
      :subtitle="shellSubtitle"
      :show-nav="!isAdminLayout"
    >
      <template v-if="isAdminLayout" #actions>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !text-xs lg:!hidden"
          @click="shell.adminNavOpen = !shell.adminNavOpen"
        >
          {{ t('common.menu') }}
        </button>
      </template>
      <template v-if="isChat" #actions>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !text-xs"
          :title="t('joule.newChat')"
          @click="startNewChat"
        >
          {{ t('joule.newChat') }}
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !text-xs"
          :class="shell.chatHistoryOpen ? '!border-[var(--sapBrandColor)] !bg-[var(--sapHighlightColor)]' : ''"
          @click="shell.toggleChatHistory()"
        >
          {{ t('joule.history') }}
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !text-xs lg:!hidden"
          @click="shell.toggleChatPreview()"
        >
          {{ t('joule.piSheet') }}
        </button>
      </template>
    </SapShellBar>

    <div class="sap-shell-body">
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
            ? 'fixed inset-y-[var(--sapShell_Height)] left-0 z-30 shadow-lg'
            : 'hidden lg:flex',
        ]"
      />
      <main class="sap-shell-main">
        <div
          class="sap-shell-content"
          :class="contentClass"
        >
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import SapShellBar from './SapShellBar.vue';
import SapSideNavigation from './SapSideNavigation.vue';
import { useShellStore } from '@/stores/shell';
import { useNewChat } from '@/composables/useNewChat';

const { t } = useI18n();
const shell = useShellStore();
const { startNewChat } = useNewChat();
const route = useRoute();

const isAdminLayout = computed(() => route.meta.layout === 'admin');
const isChat = computed(() => route.name === 'chat');

const shellTitle = computed(() => {
  if (isChat.value) return t('joule.title');
  if (isAdminLayout.value) return t('common.appName');
  return t('common.appName');
});

const shellSubtitle = computed(() => {
  if (isChat.value) return t('joule.subtitle');
  if (isAdminLayout.value) return t('shell.adminSubtitle');
  return '';
});

const contentClass = computed(() =>
  isChat.value ? 'sap-shell-content--flush' : 'sap-shell-content--padded'
);
</script>
