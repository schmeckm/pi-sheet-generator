<template>
  <ol class="mb-3 flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
    <li
      v-for="(step, idx) in steps"
      :key="step.id"
      class="flex items-center gap-1"
    >
      <span
        class="rounded-full px-2 py-1"
        :class="
          step.id === current
            ? 'bg-[var(--sapBrandColor)] text-white'
            : step.done
              ? 'bg-green-100 text-green-800'
              : 'bg-[var(--sapBackgroundColor)] text-[var(--sapContentLabelColor)]'
        "
      >
        {{ step.label }}
      </span>
      <span v-if="idx < steps.length - 1" class="text-[var(--sapContentLabelColor)]">→</span>
    </li>
  </ol>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  status: { type: String, default: 'draft' },
});

const { t } = useI18n();

const order = ['draft', 'in_review', 'approved', 'archived'];

const current = computed(() => {
  const s = props.status === 'review' ? 'in_review' : props.status || 'draft';
  return order.includes(s) ? s : 'draft';
});

const currentIdx = computed(() => order.indexOf(current.value));

const steps = computed(() =>
  order.map((id, idx) => ({
    id,
    label: t(`lifecycle.status.${id}`),
    done: idx < currentIdx.value,
  }))
);
</script>
