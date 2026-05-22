<template>
  <div class="sap-joule-composer-bar chat-input-area">
    <form class="sap-joule-composer-inline" @submit.prevent="submit">
      <textarea
        ref="textareaRef"
        v-model="text"
        rows="1"
        class="sap-textarea resize-none !border-0 !shadow-none focus:!ring-0"
        :placeholder="t('chat.placeholderJoule')"
        :disabled="disabled"
        maxlength="2000"
        @keydown.enter.exact.prevent="submit"
        @input="autoResize"
      />
      <button
        type="submit"
        class="sap-joule-send"
        :disabled="disabled || text.trim().length < 10"
        :title="t('common.send')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </form>
    <p class="mx-auto mt-2 max-w-md text-center text-[10px] text-[var(--sapContentLabelColor)]">
      <span v-if="text.length > 0 && text.length < 10">{{ t('chat.minChars') }}</span>
      <span v-else>{{ t('chat.gmpDisclaimer') }}</span>
    </p>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const emit = defineEmits(['send']);
const props = defineProps({ disabled: { type: Boolean, default: false } });

const text = ref('');
const textareaRef = ref(null);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function submit() {
  const prompt = text.value.trim();
  if (prompt.length < 10) return;
  emit('send', prompt);
  text.value = '';
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
}

watch(
  () => props.disabled,
  (d) => {
    if (!d) textareaRef.value?.focus();
  }
);

defineExpose({
  setText(value) {
    text.value = value;
    autoResize();
  },
  focus() {
    textareaRef.value?.focus();
  },
});
</script>
