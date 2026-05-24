<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.settingsTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.settingsSubtitle') }}</p>
    </header>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <div v-else-if="error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <template v-else>
      <!-- Module Status -->
      <section class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">{{ t('xstepAgent.settingsModuleStatus') }}</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingRow :label="t('xstepAgent.settingsVersion')" :value="health?.version || '-'" />
          <SettingRow :label="t('xstepAgent.settingsStatus')" :value="health?.status === 'ok' ? 'Online' : 'Offline'" :ok="health?.status === 'ok'" />
          <SettingRow :label="t('xstepAgent.llmProvider')" :value="health?.llmProvider || '-'" />
          <SettingRow label="SAP Write-Back" :value="health?.sapWriteBack ? 'Active' : 'Disabled'" :ok="!health?.sapWriteBack" />
          <SettingRow label="GMP Auto-Approval" :value="health?.autonomousGmpApproval ? 'Active' : 'Disabled'" :ok="!health?.autonomousGmpApproval" />
        </div>
      </section>

      <!-- Feature Flags -->
      <section class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">{{ t('xstepAgent.settingsFeatureFlags') }}</h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FeatureFlag v-for="(enabled, key) in health?.features" :key="key" :label="key" :enabled="enabled" />
        </div>
      </section>

      <!-- SAP BTP -->
      <section class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">SAP BTP Integration</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingRow :label="t('xstepAgent.settingsBtpEnabled')" :value="btp?.enabled ? 'Yes' : 'No'" :ok="btp?.enabled" />
          <SettingRow :label="t('xstepAgent.settingsBtpConfigured')" :value="btp?.configured ? 'Yes' : 'No'" :ok="btp?.configured" />
          <SettingRow label="URL" :value="btp?.hasUrl ? 'Configured' : 'Not set'" :ok="btp?.hasUrl" />
          <SettingRow label="Client ID" :value="btp?.hasClientId ? 'Configured' : 'Not set'" :ok="btp?.hasClientId" />
        </div>
        <p v-if="btp?.note" class="text-xs text-gray-400">{{ btp.note }}</p>
      </section>

      <!-- Index Status -->
      <section class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">{{ t('xstepAgent.settingsIndexStatus') }}</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded border p-3 text-center">
            <p class="text-2xl font-bold text-gray-900">{{ adminStats?.xsteps?.total || 0 }}</p>
            <p class="text-xs text-gray-400">XSteps</p>
          </div>
          <div class="rounded border p-3 text-center">
            <p class="text-2xl font-bold text-gray-900">{{ knowledgeStats?.totalDocs || 0 }}</p>
            <p class="text-xs text-gray-400">{{ t('xstepAgent.kpiDocuments') }}</p>
          </div>
          <div class="rounded border p-3 text-center">
            <p class="text-2xl font-bold text-gray-900">{{ knowledgeStats?.totalChunks || 0 }}</p>
            <p class="text-xs text-gray-400">Chunks</p>
          </div>
        </div>
      </section>

      <!-- Environment -->
      <section class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">{{ t('xstepAgent.settingsEnvironment') }}</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingRow label="API Base URL" :value="apiUrl" />
          <SettingRow :label="t('xstepAgent.settingsLastCheck')" :value="lastCheck" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { getHealth } from '../services/xstepAgentApi';

const { t } = useI18n();

const health = ref(null);
const adminStats = ref(null);
const knowledgeStats = ref(null);
const loading = ref(false);
const error = ref(null);
const lastCheck = ref('-');

const btp = computed(() => health.value?.sapBtp || {});
const apiUrl = import.meta.env.VITE_API_URL || '/api';

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [h, a, k] = await Promise.all([
      getHealth().catch(() => null),
      get('/admin/stats').catch(() => null),
      get('/knowledge/stats').catch(() => null),
    ]);
    health.value = h;
    adminStats.value = a;
    knowledgeStats.value = k;
    lastCheck.value = new Date().toLocaleString();
  } catch (err) {
    error.value = err?.message || 'Failed to load settings';
  } finally {
    loading.value = false;
  }
}

const SettingRow = {
  props: { label: String, value: String, ok: { type: Boolean, default: null } },
  setup(props) {
    return () =>
      h('div', { class: 'flex items-center justify-between rounded bg-gray-50 px-3 py-2' }, [
        h('span', { class: 'text-sm text-gray-600' }, props.label),
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'text-sm font-medium text-gray-800' }, props.value),
          props.ok !== null
            ? h('span', { class: `inline-block h-2 w-2 rounded-full ${props.ok ? 'bg-green-500' : 'bg-gray-300'}` })
            : null,
        ]),
      ]);
  },
};

const FeatureFlag = {
  props: { label: String, enabled: Boolean },
  setup(props) {
    return () =>
      h('div', { class: 'flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm' }, [
        h('span', { class: 'text-gray-600' }, props.label),
        h('span', {
          class: `rounded px-2 py-0.5 text-xs font-medium ${props.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`,
        }, props.enabled ? 'ON' : 'OFF'),
      ]);
  },
};

onMounted(() => { load(); });
</script>
