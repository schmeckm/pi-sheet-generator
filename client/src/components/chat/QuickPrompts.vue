<template>
  <div class="mx-auto w-full max-w-3xl px-4 pb-2">
    <p class="mb-2 text-center text-xs font-semibold text-[var(--sapContentLabelColor)]">
      {{ t('prompts.hint') }}
    </p>
    <div class="grid gap-2 sm:grid-cols-2">
      <button
        v-for="item in piPrompts"
        :key="item.key"
        type="button"
        class="joule-suggestion sap-tile flex items-start gap-3 p-3 text-left transition !shadow-none hover:!border-[var(--sapBrandColor)]"
        @click="$emit('select', item.text)"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--sapHighlightColor)] text-lg">
          {{ item.icon }}
        </span>
        <span>
          <span class="block text-sm font-semibold text-[var(--sapTextColor)]">{{ item.title }}</span>
          <span class="mt-0.5 block text-xs text-[var(--sapContentLabelColor)]">{{ item.text }}</span>
        </span>
      </button>
    </div>

    <p class="mb-2 mt-5 text-center text-xs font-semibold text-[var(--sapContentLabelColor)]">
      {{ t('prompts.equipmentHint') }}
    </p>
    <div class="grid gap-2 sm:grid-cols-2">
      <button
        v-for="item in equipmentPrompts"
        :key="item.key"
        type="button"
        class="joule-suggestion sap-tile flex items-start gap-3 p-3 text-left transition !shadow-none hover:!border-[var(--sapBrandColor)]"
        @click="$emit('select', item.text)"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-lg">
          {{ item.icon }}
        </span>
        <span>
          <span class="block text-sm font-semibold text-[var(--sapTextColor)]">{{ item.title }}</span>
          <span class="mt-0.5 block text-xs text-[var(--sapContentLabelColor)]">{{ item.text }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineEmits(['select']);
const { t } = useI18n();

const piMeta = [
  { key: 'packaging', icon: '📦' },
  { key: 'filling', icon: '💧' },
  { key: 'granulation', icon: '⚗️' },
  { key: 'gmpFull', icon: '✓' },
  { key: 'packagingGmpClose', icon: '📋' },
  { key: 'granulationTemp', icon: '🌡️' },
];

const equipmentMeta = [
  { key: 'scalesActive', icon: '⚖️' },
  { key: 'scalesLine', icon: '🏭' },
  { key: 'namespace', icon: '🔍' },
  { key: 'equipmentList', icon: '📋' },
];

const piPrompts = computed(() =>
  piMeta.map((m) => ({
    ...m,
    title: t(`prompts.${m.key}.title`),
    text: t(`prompts.${m.key}.text`),
  }))
);

const equipmentPrompts = computed(() =>
  equipmentMeta.map((m) => ({
    ...m,
    title: t(`prompts.${m.key}.title`),
    text: t(`prompts.${m.key}.text`),
  }))
);
</script>
