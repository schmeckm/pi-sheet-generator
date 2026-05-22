<template>
  <aside
    class="flex w-[var(--sapSideNavWidth)] shrink-0 flex-col border-r border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)]"
    :class="mobile ? 'absolute inset-y-0 left-0 z-30 shadow-lg' : ''"
  >
    <div class="sap-object-header flex items-center justify-between !py-3">
      <h2 class="text-sm font-semibold">{{ t('history.title') }}</h2>
      <button v-if="mobile" type="button" class="sap-btn sap-btn--ghost !p-1" @click="$emit('close')">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <p v-if="!items.length" class="px-2 py-4 text-center text-xs text-[var(--sapContentLabelColor)]">
        {{ t('history.empty') }}
      </p>
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="mb-1 w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--sapHighlightColor)]"
        :class="activeId === item.id ? 'bg-[var(--sapHighlightColor)] ring-1 ring-[var(--sapBrandColor)]' : ''"
        @click="$emit('select', item.id)"
      >
        <p class="truncate text-sm font-semibold">{{ localizeText(item.title) }}</p>
        <p class="mt-0.5 truncate text-xs text-[var(--sapContentLabelColor)]">
          {{ localizeProcessType(item.process_type) || '—' }} · {{ formatDate(item.created_at) }}
        </p>
      </button>
    </div>
    <div class="border-t border-[var(--sapNeutralBorderColor)] p-3">
      <button type="button" class="sap-btn sap-btn--transparent w-full !text-xs" @click="$emit('new-chat')">
        {{ t('history.newChat') }}
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';

defineProps({
  items: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
  mobile: { type: Boolean, default: false },
});

defineEmits(['select', 'close', 'new-chat']);

const { t, locale } = useI18n();
const { localizeProcessType, localizeText } = usePiSheetDisplay();

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(locale.value === 'en' ? 'en-GB' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
</script>
