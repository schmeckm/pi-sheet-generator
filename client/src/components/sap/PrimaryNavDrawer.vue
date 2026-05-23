<template>
  <nav
    class="primary-nav-drawer flex w-[var(--sapSideNavWidth)] max-w-[85vw] flex-col border-r border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] shadow-lg"
    :aria-label="t('shell.primaryNavAria')"
  >
    <div class="border-b border-[var(--sapNeutralBorderColor)] px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-[var(--sapContentLabelColor)]">
        {{ t('shell.primaryNavTitle') }}
      </p>
    </div>
    <ul class="flex-1 overflow-y-auto p-2">
      <li v-for="link in links" :key="link.to">
        <router-link
          :to="link.to"
          class="sap-btn sap-btn--ghost mb-1 w-full justify-start !min-h-11 !px-3 !text-sm"
          active-class="!bg-[var(--sapHighlightColor)] !text-[var(--sapSelectedColor)] !font-semibold"
          @click="shell.closePrimaryNav()"
        >
          {{ link.label }}
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { usePrimaryNav } from '@/composables/usePrimaryNav';
import { useShellStore } from '@/stores/shell';

const { t } = useI18n();
const { links } = usePrimaryNav();
const shell = useShellStore();
</script>
