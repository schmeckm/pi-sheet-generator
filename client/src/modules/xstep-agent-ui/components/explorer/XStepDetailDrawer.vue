<template>
  <div v-if="xstep" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-white shadow-xl">
    <div class="flex items-center justify-between border-b px-5 py-4">
      <h3 class="text-lg font-bold text-gray-900">{{ xstep.name }}</h3>
      <button class="rounded p-1 hover:bg-gray-100" @click="$emit('close')">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <DetailField :label="t('xstepAgent.fieldXStepId')" :value="xstep.xstep_id" />
        <DetailField :label="t('xstepAgent.fieldCategory')" :value="xstep.category" />
        <DetailField :label="t('xstepAgent.fieldProcessType')" :value="xstep.process_type" />
        <DetailField :label="t('xstepAgent.fieldSapSystem')" :value="xstep.sap_system || '-'" />
        <DetailField :label="t('xstepAgent.fieldSapTransaction')" :value="xstep.sap_transaction || '-'" />
        <DetailField :label="t('xstepAgent.fieldMovementType')" :value="xstep.movement_type || '-'" />
      </div>

      <div class="flex gap-2">
        <Badge v-if="xstep.gmp_relevant" color="green">GMP</Badge>
        <Badge v-if="xstep.signature_required" color="blue">{{ t('xstepAgent.signature') }}</Badge>
        <Badge v-if="!xstep.is_active" color="red">{{ t('xstepAgent.inactive') }}</Badge>
        <Badge v-for="tag in (xstep.tags || [])" :key="tag" color="gray">{{ tag }}</Badge>
      </div>

      <div v-if="xstep.description">
        <p class="mb-1 text-xs font-medium uppercase text-gray-400">{{ t('xstepAgent.fieldDescription') }}</p>
        <p class="text-sm text-gray-700">{{ xstep.description }}</p>
      </div>

      <div v-if="xstep.instruction_template">
        <p class="mb-1 text-xs font-medium uppercase text-gray-400">{{ t('xstepAgent.fieldInstruction') }}</p>
        <pre class="rounded bg-gray-50 p-3 text-xs text-gray-600 whitespace-pre-wrap">{{ xstep.instruction_template }}</pre>
      </div>

      <div v-if="xstep.params?.length">
        <p class="mb-1 text-xs font-medium uppercase text-gray-400">{{ t('xstepAgent.fieldParams') }}</p>
        <div class="space-y-1">
          <div v-for="p in xstep.params" :key="p.name" class="flex items-center gap-2 rounded bg-gray-50 px-3 py-1.5 text-xs">
            <span class="font-medium text-gray-700">{{ p.name }}</span>
            <span class="text-gray-400">{{ p.type || 'text' }}</span>
            <span v-if="p.required" class="text-red-400">*</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { h } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({ xstep: { type: Object, default: null } });
defineEmits(['close']);

const DetailField = {
  props: { label: String, value: String },
  setup(props) {
    return () =>
      h('div', [
        h('p', { class: 'text-xs text-gray-400' }, props.label),
        h('p', { class: 'font-medium text-gray-800' }, props.value || '-'),
      ]);
  },
};

const Badge = {
  props: { color: { type: String, default: 'gray' } },
  setup(props, { slots }) {
    const colors = {
      green: 'bg-green-100 text-green-700',
      blue: 'bg-blue-100 text-blue-700',
      red: 'bg-red-100 text-red-700',
      gray: 'bg-gray-100 text-gray-600',
    };
    return () =>
      h('span', { class: `inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[props.color] || colors.gray}` }, slots.default?.());
  },
};
</script>
