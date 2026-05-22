<template>
  <div class="shrink-0 border-t border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] px-4 py-4">
    <form class="sap-joule-composer mx-auto flex max-w-3xl flex-col" @submit.prevent="submit">
      <textarea
        ref="textareaRef"
        v-model="text"
        rows="1"
        class="sap-textarea max-h-40 min-h-[52px] resize-none !border-0 !shadow-none focus:!ring-0"
        :placeholder="t('chat.placeholder')"
        :disabled="disabled"
        maxlength="2000"
        @keydown.enter.exact.prevent="submit"
        @input="autoResize"
      />
      <div
        class="flex items-center justify-between gap-2 border-t border-[var(--sapNeutralBorderColor)] px-3 py-2"
      >
        <p class="text-[10px] text-[var(--sapContentLabelColor)]">
          <span v-if="text.length < 10">{{ t('chat.minChars') }}</span>
          <span v-else>{{ t('chat.charCount', { count: text.length }) }}</span>
        </p>
        <button
          type="submit"
          class="sap-btn sap-btn--emphasized !text-sm"
          :disabled="disabled || text.trim().length < 10"
        >
          {{ t('common.send') }}
        </button>
      </div>
    </form>
    <p class="sap-message-strip mx-auto mt-2 max-w-3xl text-center">{{ t('chat.gmpDisclaimer') }}</p>
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
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
