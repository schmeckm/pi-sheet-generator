<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.reviewTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.reviewSubtitle') }}</p>
    </header>

    <!-- Status Filter Tabs -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="s in statuses"
        :key="s.value"
        class="rounded-full border px-3 py-1 text-xs font-medium transition"
        :class="store.statusFilter === s.value ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'"
        @click="store.statusFilter = store.statusFilter === s.value ? '' : s.value"
      >
        {{ s.label }}
        <span v-if="store.statusCounts[s.value]" class="ml-1 opacity-70">({{ store.statusCounts[s.value] }})</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <!-- Empty -->
    <div v-else-if="!store.filtered.length" class="rounded-lg border bg-white p-8 text-center shadow-sm">
      <p class="text-4xl">📋</p>
      <p class="mt-2 text-gray-500">{{ t('xstepAgent.reviewEmpty') }}</p>
      <router-link to="/xstep-agent/composer" class="mt-3 inline-block text-sm text-blue-600 hover:underline">
        {{ t('xstepAgent.reviewGoToComposer') }}
      </router-link>
    </div>

    <!-- Proposal List -->
    <div v-else class="space-y-3">
      <div
        v-for="p in store.filtered"
        :key="p.id"
        class="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md hover:border-blue-300"
        @click="store.selectProposal(p.id)"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium text-gray-900">{{ p.template?.prompt || p.id }}</p>
            <p class="mt-0.5 text-xs text-gray-400">
              {{ p.id }} &middot; {{ new Date(p.createdAt).toLocaleString() }}
            </p>
          </div>
          <span class="rounded px-2 py-0.5 text-xs font-medium" :class="statusClass(p.status)">
            {{ p.status }}
          </span>
        </div>
        <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <span v-if="p.template?.processArea" class="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
            {{ p.template.processArea }}
          </span>
          <span v-if="p.template?.packagingType" class="rounded bg-purple-50 px-2 py-0.5 text-purple-600">
            {{ p.template.packagingType }}
          </span>
          <span class="text-gray-400">{{ p.template?.steps?.length || 0 }} Steps</span>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <div v-if="store.selected" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
    <div v-if="store.selected" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 class="text-lg font-bold text-gray-900">{{ t('xstepAgent.reviewDetail') }}</h3>
          <p class="text-xs text-gray-400">{{ store.selected.id }}</p>
        </div>
        <button class="rounded p-1 hover:bg-gray-100" @click="store.clearSelection()">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <!-- Status + Meta -->
        <div class="flex items-center gap-3">
          <span class="rounded px-3 py-1 text-sm font-medium" :class="statusClass(store.selected.status)">
            {{ store.selected.status }}
          </span>
          <span class="text-xs text-gray-400">
            {{ t('xstepAgent.reviewCreatedBy') }}: {{ store.selected.createdBy }}
          </span>
        </div>

        <!-- Action Error -->
        <div v-if="store.actionError" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ store.actionError }}
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <button
            v-if="store.selected.status === 'DRAFT_REQUIRES_REVIEW'"
            :disabled="store.actionLoading"
            class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            @click="store.performAction('submit')"
          >
            {{ t('xstepAgent.reviewSubmit') }}
          </button>
          <button
            v-if="store.selected.status === 'IN_REVIEW'"
            :disabled="store.actionLoading"
            class="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            @click="store.performAction('approve')"
          >
            {{ t('xstepAgent.reviewApprove') }}
          </button>
          <button
            v-if="store.selected.status === 'IN_REVIEW'"
            :disabled="store.actionLoading"
            class="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            @click="handleReject"
          >
            {{ t('xstepAgent.reviewReject') }}
          </button>
          <button
            v-if="store.selected.status === 'REJECTED'"
            :disabled="store.actionLoading"
            class="rounded border px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            @click="store.performAction('revise')"
          >
            {{ t('xstepAgent.reviewRevise') }}
          </button>
          <button
            v-if="store.selected.status === 'APPROVED'"
            :disabled="store.actionLoading"
            class="rounded border px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            @click="store.performAction('archive')"
          >
            {{ t('xstepAgent.reviewArchive') }}
          </button>
        </div>

        <!-- Reject comment input -->
        <div v-if="showRejectInput" class="space-y-2">
          <textarea
            v-model="rejectComment"
            rows="2"
            class="w-full rounded border px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            :placeholder="t('xstepAgent.reviewRejectComment')"
          />
          <div class="flex gap-2">
            <button
              :disabled="!rejectComment.trim() || store.actionLoading"
              class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              @click="confirmReject"
            >
              {{ t('xstepAgent.reviewConfirmReject') }}
            </button>
            <button class="rounded border px-3 py-1 text-sm text-gray-600" @click="showRejectInput = false">
              {{ t('xstepAgent.reviewCancelReject') }}
            </button>
          </div>
        </div>

        <!-- Steps preview -->
        <div v-if="store.selected.template?.steps?.length">
          <p class="mb-2 text-xs font-semibold uppercase text-gray-400">
            Steps ({{ store.selected.template.steps.length }})
          </p>
          <div class="space-y-1">
            <div
              v-for="step in store.selected.template.steps"
              :key="step.sequence"
              class="flex items-center gap-3 rounded bg-gray-50 px-3 py-2 text-xs"
            >
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                {{ step.sequence }}
              </span>
              <span class="flex-1 font-medium text-gray-800">{{ step.name }}</span>
              <span class="font-mono text-gray-400">{{ step.recommendedXStep }}</span>
              <span v-if="step.gmpRelevant" class="rounded bg-green-100 px-1.5 py-0.5 text-green-600">GMP</span>
            </div>
          </div>
        </div>

        <!-- Audit Trail -->
        <div v-if="store.selectedAudit.length">
          <p class="mb-2 text-xs font-semibold uppercase text-gray-400">{{ t('xstepAgent.reviewAuditTrail') }}</p>
          <div class="space-y-2">
            <div v-for="(entry, i) in store.selectedAudit" :key="i" class="flex gap-3 text-xs">
              <div class="flex flex-col items-center">
                <span class="h-2 w-2 rounded-full bg-blue-400" />
                <span v-if="i < store.selectedAudit.length - 1" class="w-px flex-1 bg-gray-200" />
              </div>
              <div class="pb-3">
                <p class="font-medium text-gray-700">{{ entry.action }}</p>
                <p class="text-gray-400">
                  {{ entry.timestamp }} &middot; {{ entry.userId }}
                </p>
                <p v-if="entry.details?.comment" class="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
                  "{{ entry.details.comment }}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useReviewStore } from '../stores/useReviewStore';

const { t } = useI18n();
const store = useReviewStore();

const showRejectInput = ref(false);
const rejectComment = ref('');

const statuses = [
  { value: 'DRAFT_REQUIRES_REVIEW', label: 'Draft' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function statusClass(status) {
  const map = {
    DRAFT_REQUIRES_REVIEW: 'bg-amber-100 text-amber-800',
    IN_REVIEW: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function handleReject() {
  showRejectInput.value = true;
  rejectComment.value = '';
}

async function confirmReject() {
  await store.performAction('reject', rejectComment.value);
  showRejectInput.value = false;
  rejectComment.value = '';
}

onMounted(() => { store.load(); });
</script>
