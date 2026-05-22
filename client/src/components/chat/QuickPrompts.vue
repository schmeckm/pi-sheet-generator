<template>
  <div class="joule-quick-prompts">
    <p class="joule-quick-prompts__heading">{{ t('prompts.hint') }}</p>
    <div class="joule-quick-prompts__grid">
      <button
        v-for="item in piPrompts"
        :key="item.key"
        type="button"
        class="joule-suggestion-card"
        @click="$emit('select', item.text)"
      >
        <span class="joule-suggestion-card__icon" aria-hidden="true">
          <QuickPromptIcon :name="item.icon" />
        </span>
        <span class="joule-suggestion-card__body">
          <span class="joule-suggestion-card__title">{{ item.title }}</span>
          <span class="joule-suggestion-card__text">{{ item.text }}</span>
        </span>
      </button>
    </div>

    <p class="joule-quick-prompts__heading joule-quick-prompts__heading--spaced">
      {{ t('prompts.equipmentHint') }}
    </p>
    <div class="joule-quick-prompts__grid">
      <button
        v-for="item in equipmentPrompts"
        :key="item.key"
        type="button"
        class="joule-suggestion-card"
        @click="$emit('select', item.text)"
      >
        <span class="joule-suggestion-card__icon" aria-hidden="true">
          <QuickPromptIcon :name="item.icon" />
        </span>
        <span class="joule-suggestion-card__body">
          <span class="joule-suggestion-card__title">{{ item.title }}</span>
          <span class="joule-suggestion-card__text">{{ item.text }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import QuickPromptIcon from '@/components/chat/QuickPromptIcon.vue';

defineEmits(['select']);
const { t } = useI18n();

const piMeta = [
  { key: 'packaging', icon: 'box' },
  { key: 'filling', icon: 'droplet' },
  { key: 'granulation', icon: 'beaker' },
  { key: 'gmpFull', icon: 'check' },
  { key: 'packagingGmpClose', icon: 'clipboard' },
  { key: 'granulationTemp', icon: 'thermometer' },
];

const equipmentMeta = [
  { key: 'scalesActive', icon: 'scale' },
  { key: 'scalesLine', icon: 'factory' },
  { key: 'namespace', icon: 'search' },
  { key: 'equipmentList', icon: 'list' },
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
