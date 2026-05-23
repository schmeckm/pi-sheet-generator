<template>
  <div class="mb-4 flex items-start gap-3 justify-start">
    <AssistantRobot size="sm" orb animated active class="mt-0.5 shrink-0" />
    <div class="sap-joule-bubble sap-joule-bubble--assistant min-w-0 max-w-[min(100%,22rem)] flex-1">
      <p class="sap-joule-accent text-xs font-semibold">{{ assistantLabel }}</p>
      <p class="mt-1 text-sm">{{ currentLabel }}</p>
      <p v-if="activeTools?.length" class="mt-1 text-[11px] text-[var(--sapContentLabelColor)]">
        {{ t('chat.toolsRunning', { tools: activeTools.join(', ') }) }}
      </p>
      <ul class="mt-3 space-y-2">
        <li
          v-for="(step, i) in steps"
          :key="step.id"
          class="flex items-start gap-2 text-xs text-[var(--sapContentLabelColor)]"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-300"
            :class="
              i < activeIndex
                ? 'sap-joule-accent-bg text-white'
                : i === activeIndex
                  ? 'border-2 border-[var(--sapJoulePrimary)] text-[var(--sapJoulePrimary)]'
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
            <span v-else-if="i === activeIndex" class="joule-thinking-dot h-1.5 w-1.5 rounded-full" />
            <span v-else>{{ i + 1 }}</span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span :class="i === activeIndex ? 'text-[var(--sapTextColor)]' : ''">
                {{ step.label }}
              </span>
              <span
                v-if="stepDurationMs(i) != null"
                class="shrink-0 tabular-nums text-[10px]"
                :class="
                  i === activeIndex
                    ? 'font-medium text-[var(--sapJoulePrimary)]'
                    : 'text-[var(--sapContentLabelColor)]'
                "
              >
                {{ formatDuration(stepDurationMs(i)) }}
              </span>
            </div>
            <p
              v-if="i === 0 && i < activeIndex && searchStats"
              class="mt-0.5 text-[10px] text-[var(--sapContentLabelColor)]"
            >
              {{ searchStatsLine }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AssistantRobot from '@/components/chat/AssistantRobot.vue';

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
  startedAt: { type: Number, default: null },
  stepStartedAt: { type: Array, default: () => [] },
  searchStats: { type: Object, default: null },
});

const { t } = useI18n();
const now = ref(Date.now());
let tickTimer = null;

onMounted(() => {
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 500);
});

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});

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

const searchStatsLine = computed(() => {
  if (!props.searchStats) return '';
  return t(`${i18nPrefix.value}.searchStats`, {
    xsteps: props.searchStats.xsteps ?? 0,
    docs: props.searchStats.docs ?? 0,
  });
});

function stepDurationMs(index) {
  const starts = props.stepStartedAt;
  const start = starts[index] ?? (index === 0 ? props.startedAt : null);
  if (!start) return null;
  if (index < activeIndex.value) {
    const end = starts[index + 1] ?? now.value;
    return Math.max(0, end - start);
  }
  if (index === activeIndex.value) {
    return Math.max(0, now.value - start);
  }
  return null;
}

function formatDuration(ms) {
  if (ms < 1000) return t(`${i18nPrefix.value}.durationSubSecond`);
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t(`${i18nPrefix.value}.durationSeconds`, { n: sec });
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem
    ? t(`${i18nPrefix.value}.durationMinutes`, { min, sec: String(rem).padStart(2, '0') })
    : t(`${i18nPrefix.value}.durationMinute`, { min });
}
</script>
