<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ t('piSheets.title') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('piSheets.subtitle') }}</p>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <select v-model="statusFilter" class="sap-input !text-sm" @change="load">
        <option value="">{{ t('piSheets.allStatuses') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">
          {{ t(`lifecycle.status.${s}`) }}
        </option>
      </select>
      <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="load">
        {{ t('repository.apply') }}
      </button>
      <span v-if="statusFilter === 'in_review'" class="text-sm text-amber-800">
        {{ t('piSheets.queueHint') }}
      </span>
    </div>

    <div v-if="loading" class="text-[var(--sapContentLabelColor)]">{{ t('common.loading') }}</div>

    <div v-else-if="!sheets.length" class="sap-tile p-8 text-center text-sm text-[var(--sapContentLabelColor)]">
      {{ t('piSheets.empty') }}
    </div>

    <div v-else class="sap-tile overflow-x-auto">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr class="border-b text-[var(--sapContentLabelColor)]">
            <th class="p-3">{{ t('piSheets.colTitle') }}</th>
            <th class="p-3">{{ t('piSheets.colStatus') }}</th>
            <th class="p-3">{{ t('piSheets.colProcess') }}</th>
            <th class="p-3">{{ t('piSheets.colCreator') }}</th>
            <th class="p-3">{{ t('piSheets.colUpdated') }}</th>
            <th class="p-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sheets"
            :key="row.id"
            class="border-b border-[var(--sapNeutralBorderColor)] hover:bg-[var(--sapList_Hover_Background)]"
          >
            <td class="p-3 font-medium">{{ localizeText(row.title) }}</td>
            <td class="p-3">
              <PISheetStatusBadge :status="row.status" />
            </td>
            <td class="p-3">{{ localizeProcessType(row.process_type) || '—' }}</td>
            <td class="p-3">{{ row.creator?.name || row.creator?.email || '—' }}</td>
            <td class="p-3">{{ formatDate(row.updated_at) }}</td>
            <td class="p-3 text-right">
              <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="openDetail(row)">
                {{ t('piSheets.review') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="detail"
      class="fixed inset-0 z-40 flex justify-end bg-black/30"
      @click.self="detail = null"
    >
      <aside
        class="flex h-full w-full max-w-lg flex-col border-l bg-[var(--sapGroupContentBackground)] shadow-xl"
      >
        <div class="sap-object-header flex items-center justify-between !py-3">
          <h2 class="text-sm font-semibold">{{ localizeText(detail.title) }}</h2>
          <button type="button" class="sap-btn sap-btn--ghost !p-2" @click="detail = null">✕</button>
        </div>
        <PISheetWorkflow :sheet="detail" @updated="onDetailUpdated" />
        <div class="min-h-0 flex-1 overflow-y-auto">
          <PISheetPreview :sheet="detail" hide-toolbar />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import PISheetStatusBadge from '@/components/pisheet/PISheetStatusBadge.vue';
import PISheetWorkflow from '@/components/pisheet/PISheetWorkflow.vue';
import PISheetPreview from '@/components/pisheet/PISheetPreview.vue';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';

const { t, locale } = useI18n();
const { localizeProcessType, localizeText } = usePiSheetDisplay();
const route = useRoute();

const statuses = ['draft', 'in_review', 'approved', 'archived'];
const statusFilter = ref(route.query.status === 'in_review' ? 'in_review' : '');
const sheets = ref([]);
const loading = ref(true);
const detail = ref(null);

function formatDate(d) {
  return new Date(d).toLocaleString(locale.value === 'en' ? 'en-GB' : 'de-DE');
}

async function load() {
  loading.value = true;
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {};
    sheets.value = await get('/templates', { params });
  } finally {
    loading.value = false;
  }
}

async function openDetail(row) {
  try {
    detail.value = await get(`/templates/${row.id}`);
  } catch {
    detail.value = row;
  }
}

function onDetailUpdated(updated) {
  detail.value = updated;
  const idx = sheets.value.findIndex((s) => s.id === updated.id);
  if (idx >= 0) sheets.value[idx] = updated;
}

onMounted(load);
</script>
