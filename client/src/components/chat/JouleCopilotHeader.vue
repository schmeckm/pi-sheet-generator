<template>
  <header class="sap-joule-copilot__header">
    <span class="sap-joule-copilot__title">{{ t('joule.title') }}</span>
    <div class="sap-joule-copilot__actions">
      <button
        type="button"
        class="sap-joule-copilot__icon-btn"
        :title="t('joule.newChat')"
        @click="$emit('new-chat')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        type="button"
        class="sap-joule-copilot__icon-btn"
        :class="{ 'sap-joule-copilot__icon-btn--active': historyOpen }"
        :title="t('joule.history')"
        @click="$emit('toggle-history')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  historyOpen: { type: Boolean, default: false },
});

defineEmits(['new-chat', 'toggle-history']);

const { t } = useI18n();
</script>
