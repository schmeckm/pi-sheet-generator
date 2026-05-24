<template>
  <div class="rounded-lg border bg-white p-5 shadow-sm">
    <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
      {{ t('xstepAgent.recentActivity') }}
    </h3>
    <div v-if="!items.length" class="py-6 text-center text-sm text-gray-400">
      {{ t('xstepAgent.noRecentActivity') }}
    </div>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-b text-left text-xs uppercase text-gray-400">
          <th class="pb-2 pr-4">{{ t('xstepAgent.colTime') }}</th>
          <th class="pb-2 pr-4">{{ t('xstepAgent.colAction') }}</th>
          <th class="pb-2">{{ t('xstepAgent.colStatus') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" class="border-b last:border-0">
          <td class="py-2 pr-4 text-gray-500">{{ item.time }}</td>
          <td class="py-2 pr-4">{{ item.action }}</td>
          <td class="py-2">
            <span
              class="inline-block rounded px-2 py-0.5 text-xs font-medium"
              :class="statusClass(item.status)"
            >
              {{ item.status }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  items: { type: Array, default: () => [] },
});

function statusClass(status) {
  const map = {
    DRAFT_REQUIRES_REVIEW: 'bg-amber-100 text-amber-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    ARCHIVED: 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}
</script>
