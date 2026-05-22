<template>
  <div class="mb-6 flex gap-3">
    <div class="sap-joule-orb flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
      <svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2a1 1 0 011 .894l1.618 8.088 7.088 1.618a1 1 0 01.416 1.789l-5.5 4.5 1.618 7.088a1 1 0 01-1.53.894l-6.5-5.5-6.5 5.5a1 1 0 01-1.53-.894l1.618-7.088-5.5-4.5a1 1 0 01.416-1.789l7.088-1.618L11 2.894A1 1 0 0112 2z"
        />
      </svg>
    </div>
    <div class="sap-tile min-w-0 flex-1 p-4 !shadow-none">
      <p class="text-xs font-semibold text-[var(--sapBrandColor)]">{{ assistantLabel }}</p>
      <p class="mt-1 text-sm">{{ currentLabel }}</p>
      <p v-if="activeTools?.length" class="mt-1 text-[11px] text-[var(--sapContentLabelColor)]">
        {{ t('chat.toolsRunning', { tools: activeTools.join(', ') }) }}
      </p>
      <ul class="mt-3 space-y-2">
        <li
          v-for="(step, i) in steps"
          :key="step.id"
          class="flex items-center gap-2 text-xs text-[var(--sapContentLabelColor)]"
        >
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
            :class="
              i < activeIndex
                ? 'bg-[var(--sapBrandColor)] text-white'
                : i === activeIndex
                  ? 'border-2 border-[var(--sapBrandColor)] text-[var(--sapBrandColor)]'
                  : 'border border-[var(--sapNeutralBorderColor)]'
            "
          >
            <svg v-if="i < activeIndex" class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            <span v-else-if="i === activeIndex" class="joule-thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--sapBrandColor)]" />
            <span v-else>{{ i + 1 }}</span>
          </span>
          {{ step.label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  phase: {
    type: String,
    default: 'searching',
    validator: (v) => ['searching', 'context', 'generating', 'structuring'].includes(v),
  },
  mode: {
    type: String,
    default: 'pi_sheet',
    validator: (v) => ['pi_sheet', 'qa'].includes(v),
  },
  activeTools: { type: Array, default: () => [] },
});

const { t } = useI18n();
const stepIds = ['search', 'context', 'generate', 'finalize'];
const i18nPrefix = computed(() => (props.mode === 'pi_sheet' ? 'thinking' : 'thinkingQa'));
const steps = computed(() =>
  stepIds.map((id) => ({ id, label: t(`${i18nPrefix.value}.steps.${id}`) }))
);
const phaseIndex = { searching: 0, context: 1, generating: 2, structuring: 3 };
const activeIndex = computed(() => phaseIndex[props.phase] ?? 0);
const currentLabel = computed(() => t(`${i18nPrefix.value}.${props.phase}`));
const assistantLabel = computed(() =>
  props.mode === 'qa' ? t('chat.assistantNameQa') : t('chat.assistantName')
);
</script>
