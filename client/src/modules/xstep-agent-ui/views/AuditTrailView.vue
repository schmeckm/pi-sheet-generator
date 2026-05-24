<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.auditTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.auditSubtitle') }}</p>
    </header>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex-1 min-w-[180px]">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.auditFilterAction') }}</label>
        <input
          v-model="actionFilter"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="z. B. pi_sheet_approve"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.auditFilterUser') }}</label>
        <input
          v-model="userFilter"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm"
          placeholder="User ID"
        />
      </div>
      <button
        class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        @click="load()"
      >
        {{ t('xstepAgent.filterApply') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.auditColTime') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.auditColUser') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.auditColAction') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.auditColEntity') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.auditColDetails') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in items" :key="entry.id" class="border-b last:border-0 hover:bg-gray-50">
            <td class="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
              {{ new Date(entry.created_at).toLocaleString() }}
            </td>
            <td class="px-4 py-2.5 text-gray-700">
              {{ entry.user?.name || entry.user?.email || entry.user_id || '-' }}
            </td>
            <td class="px-4 py-2.5">
              <span class="rounded px-2 py-0.5 text-xs font-medium" :class="actionClass(entry.action)">
                {{ entry.action }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-xs text-gray-500">
              <span v-if="entry.entity_type" class="text-gray-400">{{ entry.entity_type }}</span>
              <span v-if="entry.entity_id" class="ml-1 font-mono">{{ shortId(entry.entity_id) }}</span>
            </td>
            <td class="px-4 py-2.5">
              <button
                v-if="entry.details && Object.keys(entry.details).length"
                class="text-xs text-blue-600 hover:underline"
                @click="toggleDetails(entry.id)"
              >
                {{ expandedIds.has(entry.id) ? t('xstepAgent.auditHideDetails') : t('xstepAgent.auditShowDetails') }}
              </button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="5" class="py-8 text-center text-gray-400">{{ t('xstepAgent.noResults') }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Expanded Details -->
      <div v-for="entry in items.filter((e) => expandedIds.has(e.id))" :key="'d-' + entry.id" class="border-t bg-gray-50 px-6 py-3">
        <pre class="text-xs text-gray-600">{{ JSON.stringify(entry.details, null, 2) }}</pre>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-gray-500">{{ t('xstepAgent.pageInfo', { page, total: totalPages }) }}</p>
      <div class="flex gap-1">
        <button :disabled="page <= 1" class="rounded border px-3 py-1 text-sm disabled:opacity-40" @click="page--; load()">&laquo;</button>
        <button :disabled="page >= totalPages" class="rounded border px-3 py-1 text-sm disabled:opacity-40" @click="page++; load()">&raquo;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';

const { t } = useI18n();

const items = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref(null);
const page = ref(1);
const limit = 25;
const actionFilter = ref('');
const userFilter = ref('');
const expandedIds = reactive(new Set());

const totalPages = computed(() => Math.ceil(total.value / limit) || 1);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params = { page: page.value, limit };
    if (actionFilter.value) params.action = actionFilter.value;
    if (userFilter.value) params.user_id = userFilter.value;
    const res = await get('/admin/audit-log', { params });
    items.value = res.items || [];
    total.value = res.total || 0;
  } catch (err) {
    error.value = err?.message || 'Failed to load audit log';
  } finally {
    loading.value = false;
  }
}

function shortId(id) {
  return id?.length > 12 ? id.slice(0, 8) + '…' : id;
}

function toggleDetails(id) {
  if (expandedIds.has(id)) expandedIds.delete(id);
  else expandedIds.add(id);
}

function actionClass(action) {
  if (action?.includes('approve')) return 'bg-green-100 text-green-700';
  if (action?.includes('reject')) return 'bg-red-100 text-red-700';
  if (action?.includes('create') || action?.includes('import')) return 'bg-blue-100 text-blue-700';
  if (action?.includes('delete')) return 'bg-red-50 text-red-600';
  if (action?.includes('submit')) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

onMounted(() => { load(); });
</script>
