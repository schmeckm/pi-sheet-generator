<template>
  <header class="sap-shell-bar">
    <div class="sap-shell-bar__brand">
      <div class="sap-shell-bar__logo" aria-hidden="true">SAP</div>
      <div class="min-w-0">
        <p class="sap-shell-bar__title truncate">{{ title }}</p>
        <p v-if="subtitle" class="sap-shell-bar__subtitle truncate">{{ subtitle }}</p>
      </div>
      <nav v-if="showNav" class="ml-4 hidden gap-1 md:flex">
        <router-link
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="sap-btn sap-btn--ghost !py-1 !text-sm"
          active-class="!bg-[var(--sapHighlightColor)] !text-[var(--sapSelectedColor)] !font-semibold"
        >
          {{ link.label }}
        </router-link>
      </nav>
    </div>

    <div class="sap-shell-bar__actions">
      <slot name="actions" />
      <LanguageSwitcher variant="shell" />
      <template v-if="auth.isAuthenticated">
        <span class="hidden text-sm text-[var(--sapContentLabelColor)] lg:inline">
          {{ auth.user?.name }}
        </span>
        <span
          class="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          :class="
            auth.isAdmin
              ? 'bg-[#fff3b8] text-[#5d3800]'
              : auth.isPromptEditor
                ? 'bg-[var(--sapJouleHighlight)] text-[var(--sapJoulePrimaryDark)]'
                : 'bg-[var(--sapHighlightColor)] text-[var(--sapSelectedColor)]'
          "
        >
          {{ auth.user?.role }}
        </span>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !p-2"
          :title="t('common.logoutTitle')"
          @click="logout"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </template>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  showNav: { type: Boolean, default: true },
});

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

const navLinks = computed(() => {
  const links = [{ to: '/chat', label: t('common.chat') }];
  if (auth.isAdmin) links.push({ to: '/admin', label: t('common.admin') });
  else if (auth.canManagePrompts) links.push({ to: '/admin/prompts', label: t('nav.promptConfig') });
  return links;
});

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>
