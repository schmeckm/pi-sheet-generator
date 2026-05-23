<template>
  <header class="sticky top-0 z-40 flex items-center justify-between bg-gray-900 px-4 py-3 text-white shadow">
    <div class="flex items-center gap-6">
      <router-link to="/chat" class="text-lg font-semibold tracking-tight">
        {{ t('common.appName') }}
      </router-link>
      <nav class="hidden gap-4 sm:flex">
        <router-link to="/chat" class="text-sm hover:text-gray-300" active-class="text-white font-medium">
          {{ t('common.chat') }}
        </router-link>
        <router-link
          to="/digitalize"
          class="text-sm hover:text-gray-300"
          active-class="text-white font-medium"
        >
          {{ t('common.digitalize') }}
        </router-link>
        <router-link
          v-if="auth.isAdmin"
          to="/admin"
          class="text-sm hover:text-gray-300"
          active-class="text-white font-medium"
        >
          {{ t('common.admin') }}
        </router-link>
        <router-link
          v-else-if="auth.canManagePrompts"
          to="/admin/prompts"
          class="text-sm hover:text-gray-300"
          active-class="text-white font-medium"
        >
          {{ t('nav.promptConfig') }}
        </router-link>
      </nav>
    </div>
    <div v-if="auth.isAuthenticated" class="flex items-center gap-3 text-sm">
      <LanguageSwitcher variant="dark" />
      <span>{{ auth.user?.name }}</span>
      <span
        class="rounded-full px-2 py-0.5 text-xs"
        :class="auth.isAdmin ? 'bg-amber-600' : auth.isPromptEditor ? 'bg-sky-700' : 'bg-slate-600'"
      >
        {{ roleLabel(auth.user?.role) }}
      </span>
      <button
        type="button"
        class="rounded border border-gray-600 px-3 py-1 hover:bg-gray-800"
        @click="logout"
      >
        {{ t('common.logout') }}
      </button>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue';
import { useRoleLabel } from '@/composables/useRoleLabel';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { roleLabel } = useRoleLabel();

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>
