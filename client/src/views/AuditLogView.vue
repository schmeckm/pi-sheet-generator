<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ t('audit.title') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('audit.subtitle') }}</p>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <input
        v-model="actionFilter"
        type="text"
        class="sap-input !text-sm"
        :placeholder="t('audit.filterAction')"
        @keyup.enter="load(1)"
      />
      <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="load(1)">
        {{ t('repository.apply') }}
      </button>
    </div>

    <div v-if="loading" class="text-[var(--sapContentLabelColor)]">{{ t('common.loading') }}</div>

    <div v-else class="sap-tile overflow-x-auto">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr class="border-b text-[var(--sapContentLabelColor)]">
            <th class="p-3">{{ t('audit.colTime') }}</th>
            <th class="p-3">{{ t('audit.colUser') }}</th>
            <th class="p-3">{{ t('audit.colAction') }}</th>
            <th class="p-3">{{ t('audit.colEntity') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in items"
            :key="row.id"
            class="border-b border-[var(--sapNeutralBorderColor)]"
          >
            <td class="p-3 whitespace-nowrap">{{ formatDate(row.created_at) }}</td>
            <td class="p-3">{{ row.user?.email || '—' }}</td>
            <td class="p-3 font-mono text-xs">{{ row.action }}</td>
            <td class="p-3 text-xs text-[var(--sapContentLabelColor)]">
              {{ row.entity_type }} {{ row.entity_id?.slice(0, 8) }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center justify-between border-t p-3 text-sm">
        <span>{{ t('audit.pageInfo', { page, total: Math.ceil(total / limit) }) }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="sap-btn sap-btn--transparent !text-sm"
            :disabled="page <= 1"
            @click="load(page - 1)"
          >
            ‹
          </button>
          <button
            type="button"
            class="sap-btn sap-btn--transparent !text-sm"
            :disabled="page * limit >= total"
            @click="load(page + 1)"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';

const { t, locale } = useI18n();
const items = ref([]);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 25;
const actionFilter = ref('');

function formatDate(d) {
  return new Date(d).toLocaleString(locale.value === 'en' ? 'en-GB' : 'de-DE');
}

async function load(p = page.value) {
  loading.value = true;
  page.value = p;
  try {
    const params = { page: p, limit };
    if (actionFilter.value.trim()) params.action = actionFilter.value.trim();
    const data = await get('/admin/audit-log', { params });
    items.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(1));
</script>
