<template>
  <div class="flex flex-col items-center px-4 py-10 text-center">
    <div class="sap-joule-orb mb-5 flex h-16 w-16 items-center justify-center rounded-full">
      <svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2a1 1 0 011 .894l1.618 8.088 7.088 1.618a1 1 0 01.416 1.789l-5.5 4.5 1.618 7.088a1 1 0 01-1.53.894l-6.5-5.5-6.5 5.5a1 1 0 01-1.53-.894l1.618-7.088-5.5-4.5a1 1 0 01.416-1.789l7.088-1.618L11 2.894A1 1 0 0112 2z"
        />
      </svg>
    </div>
    <h2 class="text-xl font-bold text-[var(--sapTextColor)] sm:text-2xl">{{ greeting }}</h2>
    <p class="mt-2 max-w-lg text-sm leading-relaxed text-[var(--sapContentLabelColor)]">
      {{ t('welcome.description') }}
    </p>
    <div class="mt-6 flex flex-wrap justify-center gap-2">
      <span
        v-for="key in capKeys"
        :key="key"
        class="rounded-full border border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] px-3 py-1 text-xs text-[var(--sapContentLabelColor)]"
      >
        {{ t(`welcome.caps.${key}`) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  userName: { type: String, default: '' },
});

const { t } = useI18n();
const capKeys = ['packaging', 'filling', 'granulation', 'sapConfirmations', 'gmpIpc'];

const greeting = computed(() => {
  const namePart = props.userName ? t('welcome.greetingName', { name: props.userName }) : '';
  return t('welcome.greeting', { name: namePart });
});
</script>
