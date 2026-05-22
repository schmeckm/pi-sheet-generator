<template>
  <div class="sap-lang-switch" role="group" :aria-label="t('common.language')">
    <button
      v-for="opt in options"
      :key="opt.code"
      type="button"
      :class="{ active: locale === opt.code }"
      @click="setLocale(opt.code)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { setLocale as applyLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

defineProps({
  /** @deprecated use shell styling only */
  variant: { type: String, default: 'shell' },
});

const { t, locale } = useI18n();

const options = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
];

const auth = useAuthStore();

async function setLocale(code) {
  applyLocale(code);
  if (auth.isAuthenticated) {
    try {
      await auth.updatePreferredLocale(code);
    } catch {
      /* UI locale still applied locally */
    }
  }
}
</script>
