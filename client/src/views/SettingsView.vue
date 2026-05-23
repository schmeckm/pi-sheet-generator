<template>
  <div>
    <div class="sap-object-header mb-4 !rounded-lg">
      <h1 class="text-xl font-bold">{{ t('settings.title') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('settings.subtitle') }}</p>
    </div>

    <div v-if="loading" class="text-[var(--sapContentLabelColor)]">{{ t('common.loading') }}</div>

    <div v-else class="space-y-6">
      <section class="sap-tile p-6">
        <h2 class="text-lg font-semibold">{{ t('settings.localeTitle') }}</h2>
        <p class="mt-1 text-sm text-[var(--sapContentLabelColor)]">{{ t('settings.localeHint') }}</p>
        <p class="mt-2 text-xs text-[var(--sapContentLabelColor)]">
          {{ auth.user?.email }} · {{ auth.user?.name }}
        </p>
        <label class="mt-4 block max-w-xs">
          <span class="sap-label">{{ t('settings.localeLabel') }}</span>
          <select v-model="preferredLocale" class="sap-input">
            <option value="de">{{ t('settings.localeDe') }}</option>
            <option value="en">{{ t('settings.localeEn') }}</option>
          </select>
        </label>
        <button type="button" class="sap-btn sap-btn--emphasized mt-4" @click="saveLocale">
          {{ t('settings.localeSave') }}
        </button>
      </section>

      <section class="sap-tile p-6">
        <h2 class="text-lg font-semibold">{{ t('settings.llmTitle') }}</h2>
        <p class="mt-1 text-sm text-[var(--sapContentLabelColor)]">{{ t('settings.llmHint') }}</p>

        <div class="mt-4 flex flex-wrap gap-4 text-sm">
          <span
            class="rounded px-2 py-1"
            :class="llmOverview?.api?.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
          >
            {{
              llmOverview?.api?.configured
                ? t('settings.llmKeyOk', { hint: llmOverview.api.key_hint || '' })
                : t('settings.llmKeyMissing')
            }}
          </span>
          <span v-if="llmOverview?.api?.configured" class="text-[var(--sapContentLabelColor)]">
            {{
              llmOverview.api.reachable ? t('settings.llmReachable') : t('settings.llmUnreachable')
            }}
          </span>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-3">
          <label class="block">
            <span class="sap-label">{{ t('settings.llmModelPiSheet') }}</span>
            <select v-model="form.llm_model_pi_sheet" class="sap-input">
              <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.llmModelQa') }}</span>
            <select v-model="form.llm_model_qa" class="sap-input">
              <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.llmModelVision') }}</span>
            <select v-model="form.llm_model_vision" class="sap-input">
              <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="block">
            <span class="sap-label">{{ t('settings.llmMaxTokensPi') }}</span>
            <input v-model.number="form.llm_max_tokens_pi_sheet" type="number" min="256" max="8000" class="sap-input" />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.llmMaxTokensQa') }}</span>
            <input v-model.number="form.llm_max_tokens_qa" type="number" min="256" max="8000" class="sap-input" />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.llmMaxTokensVision') }}</span>
            <input v-model.number="form.llm_max_tokens_vision" type="number" min="256" max="8000" class="sap-input" />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.llmDailyBudget') }}</span>
            <input v-model.number="form.llm_token_budget_daily_per_user" type="number" min="0" step="1000" class="sap-input" />
            <span class="mt-1 block text-xs text-[var(--sapContentLabelColor)]">{{ t('settings.llmDailyBudgetHint') }}</span>
          </label>
        </div>

        <div v-if="llmOverview?.budget" class="mt-6 rounded border border-[var(--sapGroup_ContentBorderColor)] p-4 text-sm">
          <h3 class="font-semibold">{{ t('settings.llmUsageTitle') }}</h3>
          <ul class="mt-2 space-y-1 text-[var(--sapContentLabelColor)]">
            <li>
              {{ t('settings.llmUsageYou') }}:
              <strong class="text-[var(--sapTextColor)]">
                <template v-if="llmOverview.budget.user.unlimited">{{ t('settings.llmUnlimited') }}</template>
                <template v-else>
                  {{ formatNum(llmOverview.budget.user.used) }} /
                  {{ formatNum(llmOverview.budget.user.budget) }}
                  ({{ t('settings.llmRemaining', { n: formatNum(llmOverview.budget.user.remaining) }) }})
                </template>
              </strong>
            </li>
            <li>
              {{ t('settings.llmUsageOrg') }}:
              <strong class="text-[var(--sapTextColor)]">
                {{ formatNum(llmOverview.budget.organization_today?.total_tokens) }}
                {{ t('settings.llmTokens') }}
                ({{ llmOverview.budget.organization_today?.active_users || 0 }}
                {{ t('settings.llmUsers') }})
              </strong>
            </li>
          </ul>
          <p class="mt-3 text-xs">{{ t('settings.llmAnthropicBalanceNote') }}</p>
          <p
            v-if="llmOverview.anthropic_account?.usage_last_7d?.available"
            class="mt-2 text-xs text-[var(--sapTextColor)]"
          >
            {{ t('settings.llmAnthropicUsage7d', {
              tokens: formatNum(llmOverview.anthropic_account.usage_last_7d.total_tokens),
            }) }}
          </p>
        </div>
      </section>

      <section class="sap-tile p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('settings.sapTitle') }}</h2>
            <p class="mt-1 text-sm text-[var(--sapContentLabelColor)]">
              {{ form.sap_integration_enabled ? t('settings.sapOnHint') : t('settings.sapOffHint') }}
            </p>
          </div>
          <label class="flex items-center gap-3">
            <span class="text-sm font-medium">{{ t('settings.sapEnable') }}</span>
            <input v-model="form.sap_integration_enabled" type="checkbox" class="h-5 w-5" />
          </label>
        </div>

        <div v-if="form.sap_integration_enabled" class="mt-6 grid gap-4 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="sap-label">MCP URL</span>
            <input v-model="form.sap_mcp_url" class="sap-input" />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.connType') }}</span>
            <select v-model="form.sap_connection_type" class="sap-input">
              <option value="mock">Mock</option>
              <option value="rfc">SAP RFC</option>
              <option value="odata">SAP OData</option>
              <option value="me_api">SAP ME API</option>
            </select>
          </label>
          <label class="block">
            <span class="sap-label">{{ t('settings.syncInterval') }}</span>
            <input v-model.number="form.sap_sync_interval_minutes" type="number" min="5" class="sap-input" />
          </label>
          <label class="flex items-center gap-2 sm:col-span-2">
            <input v-model="form.sap_auto_sync" type="checkbox" />
            <span>{{ t('settings.autoSync') }}</span>
          </label>
        </div>

        <div v-if="form.sap_integration_enabled" class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="sap-btn sap-btn--transparent" :disabled="testing" @click="testConn">
            {{ testing ? t('settings.testing') : t('settings.testConn') }}
          </button>
          <button type="button" class="sap-btn sap-btn--transparent" :disabled="syncing" @click="syncNow">
            {{ syncing ? t('settings.syncing') : t('settings.syncNow') }}
          </button>
        </div>

        <p v-if="testMsg" class="mt-3 text-sm" :class="testOk ? 'text-green-700' : 'text-red-700'">{{ testMsg }}</p>
        <p v-if="sapStatus?.last_sync_at" class="mt-2 text-xs text-[var(--sapContentLabelColor)]">
          {{ t('settings.lastSync') }}: {{ sapStatus.last_sync_at }}
        </p>
      </section>

      <button type="button" class="sap-btn sap-btn--emphasized" @click="saveAll">{{ t('settings.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, put, post } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const toast = useToast();
const auth = useAuthStore();

const preferredLocale = ref('de');

const loading = ref(true);
const testing = ref(false);
const syncing = ref(false);
const testMsg = ref('');
const testOk = ref(false);
const sapStatus = ref(null);
const llmOverview = ref(null);

const form = ref({
  sap_integration_enabled: false,
  sap_mcp_url: 'http://localhost:7001/sse',
  sap_connection_type: 'mock',
  sap_auto_sync: false,
  sap_sync_interval_minutes: 60,
  llm_model_pi_sheet: 'claude-sonnet-4-20250514',
  llm_model_qa: 'claude-haiku-4-20250514',
  llm_model_vision: 'claude-sonnet-4-20250514',
  llm_max_tokens_pi_sheet: 2500,
  llm_max_tokens_qa: 1500,
  llm_max_tokens_vision: 8000,
  llm_token_budget_daily_per_user: 250000,
});

const modelOptions = computed(() => {
  const fromApi = llmOverview.value?.models?.selectable;
  if (Array.isArray(fromApi) && fromApi.length) return fromApi;
  return [
    form.value.llm_model_pi_sheet,
    form.value.llm_model_qa,
    form.value.llm_model_vision,
  ].filter(Boolean);
});

function formatNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString();
}

function loadLocaleFromUser() {
  const loc = auth.user?.preferred_locale;
  preferredLocale.value = loc === 'en' ? 'en' : 'de';
}

async function saveLocale() {
  try {
    await auth.updatePreferredLocale(preferredLocale.value);
    toast.success(t('settings.localeSaved'));
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function load() {
  loading.value = true;
  try {
    await auth.ensureProfile();
    loadLocaleFromUser();
    const [all, llm] = await Promise.all([get('/settings'), get('/settings/llm')]);
    llmOverview.value = llm;
    form.value.llm_model_pi_sheet =
      all.llm_model_pi_sheet || llm?.models?.pi_sheet?.model || form.value.llm_model_pi_sheet;
    form.value.llm_model_qa = all.llm_model_qa || llm?.models?.qa?.model || form.value.llm_model_qa;
    form.value.llm_model_vision =
      all.llm_model_vision || llm?.models?.vision?.model || form.value.llm_model_vision;
    form.value.llm_max_tokens_pi_sheet = Number(all.llm_max_tokens_pi_sheet) || llm?.models?.pi_sheet?.max_tokens || 2500;
    form.value.llm_max_tokens_qa = Number(all.llm_max_tokens_qa) || llm?.models?.qa?.max_tokens || 1500;
    form.value.llm_max_tokens_vision = Number(all.llm_max_tokens_vision) || llm?.models?.vision?.max_tokens || 8000;
    form.value.llm_token_budget_daily_per_user =
      Number(all.llm_token_budget_daily_per_user) || llm?.budget?.daily_per_user || 250000;
    form.value.sap_integration_enabled = all.sap_integration_enabled === 'true';
    form.value.sap_mcp_url = all.sap_mcp_url || form.value.sap_mcp_url;
    form.value.sap_connection_type = all.sap_connection_type || 'mock';
    form.value.sap_auto_sync = all.sap_auto_sync === 'true';
    form.value.sap_sync_interval_minutes = Number(all.sap_sync_interval_minutes) || 60;
    sapStatus.value = await get('/settings/sap/status');
  } catch (e) {
    toast.error(e.response?.data?.error || t('settings.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function saveAll() {
  try {
    const entries = Object.entries({
      sap_integration_enabled: form.value.sap_integration_enabled,
      sap_mcp_url: form.value.sap_mcp_url,
      sap_connection_type: form.value.sap_connection_type,
      sap_auto_sync: form.value.sap_auto_sync,
      sap_sync_interval_minutes: String(form.value.sap_sync_interval_minutes),
      llm_model_pi_sheet: form.value.llm_model_pi_sheet,
      llm_model_qa: form.value.llm_model_qa,
      llm_model_vision: form.value.llm_model_vision,
      llm_max_tokens_pi_sheet: String(form.value.llm_max_tokens_pi_sheet),
      llm_max_tokens_qa: String(form.value.llm_max_tokens_qa),
      llm_max_tokens_vision: String(form.value.llm_max_tokens_vision),
      llm_token_budget_daily_per_user: String(form.value.llm_token_budget_daily_per_user),
    });
    for (const [key, value] of entries) {
      await put(`/settings/${key}`, { value });
    }
    toast.success(t('settings.saved'));
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function testConn() {
  testing.value = true;
  testMsg.value = '';
  try {
    await saveAll();
    const res = await post('/settings/sap/test-connection');
    testOk.value = res.success;
    testMsg.value = res.message;
  } catch (e) {
    testOk.value = false;
    testMsg.value = e.response?.data?.error || e.message;
  } finally {
    testing.value = false;
  }
}

async function syncNow() {
  syncing.value = true;
  try {
    await saveAll();
    const report = await post('/settings/sap/sync');
    toast.success(t('settings.syncDone', { created: report.created, updated: report.updated }));
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
</script>
