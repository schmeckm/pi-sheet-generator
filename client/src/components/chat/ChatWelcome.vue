<template>
  <div class="sap-joule-hero">
    <div class="sap-joule-welcome-card">
      <div class="sap-joule-welcome-card__icon">
        <AssistantRobot class="sap-joule-hero__robot" size="hero" hero />
      </div>
      <div class="sap-joule-welcome-card__text">
        <p class="sap-joule-welcome-card__hi">{{ hiLine }}</p>
        <p class="sap-joule-welcome-card__lead">{{ t('welcome.jouleGreetingLead') }}</p>
      </div>
    </div>

    <QuickPrompts class="quick-prompts sap-joule-hero__prompts" @select="$emit('quick-prompt', $event)" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AssistantRobot from '@/components/chat/AssistantRobot.vue';
import QuickPrompts from '@/components/chat/QuickPrompts.vue';

const props = defineProps({
  userName: { type: String, default: '' },
});

defineEmits(['quick-prompt']);

const { t } = useI18n();

const hiLine = computed(() =>
  props.userName
    ? t('welcome.jouleGreetingHi', { name: props.userName })
    : t('welcome.jouleGreetingHiGuest')
);
</script>
