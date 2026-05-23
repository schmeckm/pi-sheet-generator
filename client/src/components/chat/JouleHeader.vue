<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-joule-border bg-joule-surface px-4 shadow-sm"
  >
    <div class="flex items-center gap-3">
      <AssistantRobot size="sm" orb animated />
      <div>
        <h1 class="text-sm font-semibold text-joule-text">{{ t('joule.title') }}</h1>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <LanguageSwitcher />
      <button
        type="button"
        class="rounded-lg border border-joule-border px-3 py-1.5 text-xs font-medium text-joule-text-secondary transition hover:border-joule-primary hover:text-joule-primary"
        :class="showHistory ? 'border-joule-primary bg-joule-highlight text-joule-primary' : ''"
        @click="$emit('toggle-history')"
      >
        {{ t('joule.history') }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-joule-border px-3 py-1.5 text-xs font-medium text-joule-text-secondary transition hover:border-joule-primary hover:text-joule-primary lg:hidden"
        @click="$emit('toggle-preview')"
      >
        {{ t('joule.piSheet') }}
      </button>
      <div class="hidden h-6 w-px bg-joule-border sm:block" />
      <span class="hidden text-sm text-joule-text sm:inline">{{ auth.user?.name }}</span>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        :class="auth.isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-joule-highlight text-joule-primary-hover'"
      >
        {{ roleLabel(auth.user?.role) }}
      </span>
      <button
        type="button"
        class="rounded-lg p-2 text-joule-text-secondary hover:bg-joule-shell"
        :title="t('common.logoutTitle')"
        @click="logout"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue';
import AssistantRobot from '@/components/chat/AssistantRobot.vue';
import { useRoleLabel } from '@/composables/useRoleLabel';

defineProps({
  showHistory: { type: Boolean, default: false },
});

defineEmits(['toggle-history', 'toggle-preview']);

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { roleLabel } = useRoleLabel();

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>
