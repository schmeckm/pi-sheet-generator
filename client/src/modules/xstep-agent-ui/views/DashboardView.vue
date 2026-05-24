<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.dashboardTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.dashboardSubtitle') }}</p>
    </header>

    <div v-if="store.loading" class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <div v-else-if="store.error" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="font-medium text-red-700">{{ t('xstepAgent.loadError') }}</p>
      <p class="mt-1 text-sm text-red-500">{{ store.error }}</p>
      <button class="mt-3 rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700" @click="store.load()">
        {{ t('xstepAgent.retry') }}
      </button>
    </div>

    <template v-else-if="store.stats">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          :label="t('xstepAgent.kpiXSteps')"
          :value="store.stats.xstepsIndexed"
          :subtitle="`${store.stats.xstepsGmpRelevant || 0} GMP-relevant`"
          icon="🧩"
          variant="info"
        />
        <KpiCard
          :label="t('xstepAgent.kpiSopChunks')"
          :value="store.stats.sopChunksIndexed"
          :subtitle="`${store.stats.documentsIndexed || 0} ${t('xstepAgent.kpiDocuments')}`"
          icon="📚"
          variant="info"
        />
        <KpiCard
          :label="t('xstepAgent.kpiTemplates')"
          :value="store.stats.templatesTotal"
          :subtitle="`${store.stats.templatesThisWeek || 0} ${t('xstepAgent.thisWeek')}`"
          icon="📄"
          variant="default"
        />
        <KpiCard
          :label="t('xstepAgent.kpiPendingReviews')"
          :value="store.stats.pendingReviews"
          :subtitle="`${store.stats.drafts || 0} ${t('xstepAgent.drafts')}`"
          :variant="store.stats.pendingReviews > 0 ? 'warning' : 'success'"
          icon="📋"
        />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SystemStatusPanel :stats="store.stats" />
        <RecentActivityTable :items="store.stats.recentActivity || []" />
      </div>

      <div class="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
        <div>
          <p class="text-sm font-medium text-gray-700">{{ t('xstepAgent.quickActions') }}</p>
          <p class="text-xs text-gray-400">{{ t('xstepAgent.quickActionsHint') }}</p>
        </div>
        <div class="flex gap-2">
          <router-link
            to="/xstep-agent/composer"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {{ t('xstepAgent.actionCompose') }}
          </router-link>
          <router-link
            to="/xstep-agent/xsteps"
            class="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {{ t('xstepAgent.actionBrowseXSteps') }}
          </router-link>
        </div>
      </div>
    </template>

    <p v-if="store.lastFetched" class="text-right text-xs text-gray-300">
      {{ t('xstepAgent.lastUpdated') }}: {{ store.lastFetched }}
    </p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useXStepDashboardStore } from '../stores/useXStepDashboardStore';
import KpiCard from '../components/dashboard/KpiCard.vue';
import SystemStatusPanel from '../components/dashboard/SystemStatusPanel.vue';
import RecentActivityTable from '../components/dashboard/RecentActivityTable.vue';

const { t } = useI18n();
const store = useXStepDashboardStore();

onMounted(() => {
  store.load();
});
</script>
