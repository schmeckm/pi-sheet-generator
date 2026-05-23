<template>
  <div class="mb-4 flex" :class="isUser ? 'justify-end' : 'justify-start'">
    <div class="min-w-0 flex flex-col" :class="isUser ? 'items-end' : 'items-start'">
      <div class="sap-joule-bubble" :class="isUser ? 'sap-joule-bubble--user' : 'sap-joule-bubble--assistant'">
        <p class="whitespace-pre-wrap" :class="{ 'joule-stream-cursor': message.streaming }">
          {{ message.content }}
        </p>

        <div
          v-if="message.piSheet && !message.streaming"
          class="mt-3 rounded-lg border border-[var(--sapNeutralBorderColor)] bg-white p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="sap-joule-accent text-[10px] font-bold uppercase tracking-wide">
                {{ t('chat.resultCard.label') }}
              </p>
              <p class="mt-1 font-semibold text-[var(--sapTextColor)]">
                {{ localizeText(message.piSheet.title) }}
              </p>
              <p class="text-xs text-[var(--sapContentLabelColor)]">
                {{
                  t('chat.resultCard.steps', {
                    type: localizeProcessType(message.piSheet.process_type),
                    count: message.piSheet.steps?.length || 0,
                  })
                }}
              </p>
            </div>
            <span class="sap-message-strip !py-0.5 !text-[10px]">{{ t('chat.resultCard.reviewRequired') }}</span>
          </div>
          <button
            type="button"
            class="sap-btn sap-btn--emphasized mt-3 w-full !text-xs"
            @click="$emit('open-preview', message.piSheet)"
          >
            {{ t('chat.resultCard.openPreview') }}
          </button>
          <TokenUsageLine :usage="message.tokenUsage || message.piSheet?.llm_usage" class="mt-2" />
        </div>
      </div>

      <TokenUsageLine
        v-if="!message.piSheet && message.tokenUsage && !message.streaming"
        :usage="message.tokenUsage"
      />

      <p v-if="message.timestamp" class="mt-1 px-1 text-[10px] text-[var(--sapContentLabelColor)]">
        {{ formatTime(message.timestamp) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';
import TokenUsageLine from '@/components/shared/TokenUsageLine.vue';

const { localizeProcessType, localizeText } = usePiSheetDisplay();

const props = defineProps({
  message: { type: Object, required: true },
});

defineEmits(['open-preview']);

const { t, locale } = useI18n();
const isUser = computed(() => props.message.role === 'user');

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(locale.value === 'en' ? 'en-GB' : 'de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
