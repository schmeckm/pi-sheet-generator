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

      <section class="sap-tile p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('settings.plantExplorerTitle') }}</h2>
            <p class="mt-1 text-sm text-[var(--sapContentLabelColor)]">
              {{
                form.plant_explorer_enabled
                  ? t('settings.plantExplorerOnHint')
                  : t('settings.plantExplorerOffHint')
              }}
            </p>
          </div>
          <label class="flex items-center gap-3">
            <span class="text-sm font-medium">{{ t('settings.plantExplorerEnable') }}</span>
            <input v-model="form.plant_explorer_enabled" type="checkbox" class="h-5 w-5" />
          </label>
        </div>
      </section>

      <button type="button" class="sap-btn sap-btn--emphasized" @click="saveAll">{{ t('settings.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, put, post } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';

const { t } = useI18n();
const toast = useToast();
const auth = useAuthStore();
const features = useFeaturesStore();

const preferredLocale = ref('de');

const loading = ref(true);
const testing = ref(false);
const syncing = ref(false);
const testMsg = ref('');
const testOk = ref(false);
const sapStatus = ref(null);

const form = ref({
  plant_explorer_enabled: false,
  sap_integration_enabled: false,
  sap_mcp_url: 'http://localhost:7001/sse',
  sap_connection_type: 'mock',
  sap_auto_sync: false,
  sap_sync_interval_minutes: 60,
});

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
    const all = await get('/settings');
    form.value.plant_explorer_enabled = all.plant_explorer_enabled === 'true';
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
      plant_explorer_enabled: form.value.plant_explorer_enabled,
      sap_integration_enabled: form.value.sap_integration_enabled,
      sap_mcp_url: form.value.sap_mcp_url,
      sap_connection_type: form.value.sap_connection_type,
      sap_auto_sync: form.value.sap_auto_sync,
      sap_sync_interval_minutes: String(form.value.sap_sync_interval_minutes),
    });
    for (const [key, value] of entries) {
      await put(`/settings/${key}`, { value });
    }
    toast.success(t('settings.saved'));
    await features.reload();
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
