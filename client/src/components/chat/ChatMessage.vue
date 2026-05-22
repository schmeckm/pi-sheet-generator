<template>
  <div class="mb-6 flex gap-3" :class="isUser ? 'flex-row-reverse' : ''">
    <div
      v-if="!isUser"
      class="sap-joule-orb flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      aria-hidden="true"
    >
      <svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2a1 1 0 011 .894l1.618 8.088 7.088 1.618a1 1 0 01.416 1.789l-5.5 4.5 1.618 7.088a1 1 0 01-1.53.894l-6.5-5.5-6.5 5.5a1 1 0 01-1.53-.894l1.618-7.088-5.5-4.5a1 1 0 01.416-1.789l7.088-1.618L11 2.894A1 1 0 0112 2z"
        />
      </svg>
    </div>
    <div
      v-else
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sapShellTextColor)] text-xs font-semibold text-white"
    >
      {{ userInitial }}
    </div>

    <div class="min-w-0 max-w-[min(100%,42rem)] flex-1" :class="isUser ? 'flex flex-col items-end' : ''">
      <p v-if="!isUser" class="mb-1 text-xs font-semibold text-[var(--sapBrandColor)]">
        {{ message.requestMode === 'qa' ? t('chat.assistantNameQa') : t('chat.assistantName') }}
      </p>

      <div
        class="rounded-lg px-4 py-3 text-sm leading-relaxed"
        :class="
          isUser
            ? 'bg-[var(--sapBrandColor)] text-white'
            : 'sap-tile !shadow-none'
        "
      >
        <p class="whitespace-pre-wrap" :class="{ 'joule-stream-cursor': message.streaming }">
          {{ message.content }}
        </p>

        <div v-if="message.piSheet && !message.streaming" class="mt-4 rounded-lg bg-[var(--sapBackgroundColor)] p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-[var(--sapBrandColor)]">
                {{ t('chat.resultCard.label') }}
              </p>
              <p class="mt-1 font-semibold">{{ localizeText(message.piSheet.title) }}</p>
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
        </div>
      </div>

      <p v-if="message.timestamp" class="mt-1 text-[10px] text-[var(--sapContentLabelColor)]">
        {{ formatTime(message.timestamp) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';

const { localizeProcessType, localizeText } = usePiSheetDisplay();

const props = defineProps({
  message: { type: Object, required: true },
});

defineEmits(['open-preview']);

const { t, locale } = useI18n();
const auth = useAuthStore();
const isUser = computed(() => props.message.role === 'user');
const userInitial = computed(() => (auth.user?.name?.[0] || 'U').toUpperCase());

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(locale.value === 'en' ? 'en-GB' : 'de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
