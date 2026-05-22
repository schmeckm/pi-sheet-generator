<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ t('admin.dashboardTitle') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('shell.adminSubtitle') }}</p>
    </div>

    <div v-if="loading" class="text-[var(--sapContentLabelColor)]">{{ t('common.loading') }}</div>

    <template v-else-if="stats">
      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="card in statCards" :key="card.label" class="sap-tile p-6">
          <p class="text-sm text-[var(--sapContentLabelColor)]">{{ card.label }}</p>
          <p class="text-3xl font-bold text-[var(--sapBrandColor)]">{{ card.value }}</p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="sap-tile p-6">
          <h2 class="mb-3 font-semibold">{{ t('admin.byProcess') }}</h2>
          <ul class="space-y-1 text-sm">
            <li v-for="(n, type) in stats.xsteps.byProcessType" :key="type">
              {{ type }}: <strong>{{ n }}</strong>
            </li>
          </ul>
        </div>
        <div class="sap-tile p-6">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold">{{ t('admin.byStatus') }}</h2>
            <router-link
              v-if="stats.templates.byStatus.in_review"
              :to="{ name: 'admin-pi-sheets', query: { status: 'in_review' } }"
              class="text-sm text-[var(--sapBrandColor)] hover:underline"
            >
              {{ t('piSheets.queueHint') }} ({{ stats.templates.byStatus.in_review }})
            </router-link>
          </div>
          <ul class="space-y-1 text-sm">
            <li v-for="(n, status) in stats.templates.byStatus" :key="status">
              {{ status }}: <strong>{{ n }}</strong>
            </li>
          </ul>
        </div>
      </div>

      <div class="sap-tile mt-6 p-6">
        <h2 class="mb-3 font-semibold">{{ t('admin.recentActivity') }}</h2>
        <ul class="divide-y text-sm">
          <li v-for="a in stats.recentActivity" :key="a.id" class="py-2">
            <span class="text-[var(--sapContentLabelColor)]">{{ formatDate(a.created_at) }}</span>
            · {{ a.user?.email || 'System' }} · {{ a.action }}
            <span v-if="a.entity_type" class="text-[var(--sapContentLabelColor)]">({{ a.entity_type }})</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';

const { t, locale } = useI18n();
const stats = ref(null);
const loading = ref(true);

const statCards = computed(() => {
  if (!stats.value) return [];
  return [
    { label: t('admin.xstepsTotal'), value: stats.value.xsteps.total },
    { label: t('admin.piSheets'), value: stats.value.templates.total },
    { label: t('admin.users'), value: stats.value.users.total },
    { label: t('admin.gmpXsteps'), value: stats.value.xsteps.gmpRelevant },
  ];
});

function formatDate(d) {
  return new Date(d).toLocaleString(locale.value === 'en' ? 'en-GB' : 'de-DE');
}

onMounted(async () => {
  try {
    stats.value = await get('/admin/stats');
  } finally {
    loading.value = false;
  }
});
</script>
