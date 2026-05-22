<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      @click.self="cancel"
    >
      <div class="sap-tile w-full max-w-md p-6 shadow-lg">
        <h2 v-if="state.title" class="text-lg font-bold">{{ state.title }}</h2>
        <p class="mt-2 text-sm text-[var(--sapContentLabelColor)]">{{ state.message }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="sap-btn sap-btn--transparent" @click="cancel">
            {{ state.cancelLabel || t('common.cancel') }}
          </button>
          <button
            type="button"
            class="sap-btn"
            :class="state.variant === 'danger' ? 'sap-btn--negative' : 'sap-btn--emphasized'"
            @click="accept"
          >
            {{ state.confirmLabel || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useConfirm } from '@/composables/useConfirm';

const { t } = useI18n();
const { state, accept, cancel } = useConfirm();
</script>
