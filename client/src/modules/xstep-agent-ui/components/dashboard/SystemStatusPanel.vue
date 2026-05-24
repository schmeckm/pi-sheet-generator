<template>
  <div class="rounded-lg border bg-white p-5 shadow-sm">
    <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
      {{ t('xstepAgent.systemStatus') }}
    </h3>
    <div class="space-y-3">
      <StatusRow :label="t('xstepAgent.agentModule')" :status="agentOk" :detail="version" />
      <StatusRow :label="t('xstepAgent.llmProvider')" :status="true" :detail="llmProvider" />
      <StatusRow :label="t('xstepAgent.sapBtp')" :status="btpConfigured" :detail="btpNote" />
      <StatusRow
        v-for="(enabled, key) in features"
        :key="key"
        :label="featureLabel(key)"
        :status="enabled"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
});

const agentOk = computed(() => props.stats?.systemStatus === 'OK');
const version = computed(() => props.stats?.moduleVersion || '-');
const llmProvider = computed(() => props.stats?.llmProvider || '-');
const btpConfigured = computed(() => props.stats?.sapBtp?.configured || false);
const btpNote = computed(() => props.stats?.sapBtp?.note || '');
const features = computed(() => props.stats?.features || {});

function featureLabel(key) {
  const labels = {
    retrieval: 'Retrieval',
    knowledgeGraph: t('xstepAgent.knowledgeGraph'),
    piSheetExamples: 'PI Sheet Examples',
    sapXmlExport: 'SAP XML Export',
    approvalWorkflow: t('xstepAgent.approvalWorkflow'),
    auditTrail: t('xstepAgent.auditTrail'),
  };
  return labels[key] || key;
}

const StatusRow = {
  props: {
    label: String,
    status: Boolean,
    detail: { type: String, default: '' },
  },
  setup(props) {
    return () =>
      h('div', { class: 'flex items-center justify-between text-sm' }, [
        h('span', { class: 'text-gray-600' }, props.label),
        h('div', { class: 'flex items-center gap-2' }, [
          props.detail
            ? h('span', { class: 'text-xs text-gray-400' }, props.detail)
            : null,
          h(
            'span',
            {
              class: [
                'inline-block h-2.5 w-2.5 rounded-full',
                props.status ? 'bg-green-500' : 'bg-gray-300',
              ].join(' '),
            }
          ),
        ]),
      ]);
  },
};
</script>
