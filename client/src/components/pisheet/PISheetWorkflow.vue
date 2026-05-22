<template>
  <div
    v-if="sheet?.id"
    class="border-b border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] p-3 print:hidden"
  >
    <PISheetLifecycleStepper :status="sheet.status" />
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <PISheetStatusBadge :status="sheet.status" />
      <span v-if="readOnly" class="text-xs text-[var(--sapContentLabelColor)]">
        {{ t('lifecycle.readOnly') }}
      </span>
    </div>

    <p v-if="sheet.review_comment && sheet.status === 'draft'" class="mb-2 text-xs text-amber-800">
      {{ t('lifecycle.rejectionNote') }}: {{ sheet.review_comment }}
    </p>

    <p v-if="sheet.approved_at && sheet.approver" class="mb-2 text-xs text-green-800">
      {{
        t('lifecycle.approvedBy', {
          name: sheet.approver.name || sheet.approver.email,
          date: formatDate(sheet.approved_at),
        })
      }}
    </p>

    <div v-if="canSubmit" class="flex flex-wrap items-end gap-2">
      <label class="flex flex-col text-xs">
        {{ t('lifecycle.orderNumber') }}
        <input v-model="orderNumber" type="text" class="sap-input mt-1 !text-sm" maxlength="50" />
      </label>
      <label class="flex flex-col text-xs">
        {{ t('lifecycle.batchNumber') }}
        <input v-model="batchNumber" type="text" class="sap-input mt-1 !text-sm" maxlength="50" />
      </label>
      <button
        type="button"
        class="sap-btn sap-btn--emphasized !text-sm"
        :disabled="busy"
        @click="runAction('submit')"
      >
        {{ t('lifecycle.submit') }}
      </button>
    </div>

    <div v-if="canReview" class="space-y-2">
      <label class="block text-xs">
        {{ t('lifecycle.reviewComment') }}
        <textarea
          v-model="comment"
          rows="2"
          class="sap-input mt-1 w-full !text-sm"
          :placeholder="t('lifecycle.reviewCommentPlaceholder')"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="sap-btn sap-btn--emphasized !text-sm"
          :disabled="busy"
          @click="runAction('approve')"
        >
          {{ t('lifecycle.approve') }}
        </button>
        <button
          type="button"
          class="sap-btn sap-btn--negative !text-sm"
          :disabled="busy || !comment.trim()"
          @click="runAction('reject')"
        >
          {{ t('lifecycle.reject') }}
        </button>
      </div>
    </div>

    <div v-if="canArchive" class="mt-1">
      <button
        type="button"
        class="sap-btn sap-btn--transparent !text-sm"
        :disabled="busy"
        @click="runAction('archive')"
      >
        {{ t('lifecycle.archive') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { post } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import PISheetStatusBadge from './PISheetStatusBadge.vue';
import PISheetLifecycleStepper from './PISheetLifecycleStepper.vue';

const props = defineProps({
  sheet: { type: Object, default: null },
});

const emit = defineEmits(['updated']);

const { t, locale } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const busy = ref(false);
const comment = ref('');
const orderNumber = ref('');
const batchNumber = ref('');

watch(
  () => props.sheet,
  (s) => {
    orderNumber.value = s?.order_number || '';
    batchNumber.value = s?.batch_number || '';
    if (s?.status !== 'draft') comment.value = '';
  },
  { immediate: true }
);

const status = computed(() => {
  const s = props.sheet?.status || 'draft';
  return s === 'review' ? 'in_review' : s;
});

const readOnly = computed(() => ['approved', 'archived'].includes(status.value));

const canSubmit = computed(() => {
  if (status.value !== 'draft' || !props.sheet?.id) return false;
  return auth.isAdmin || props.sheet.created_by === auth.user?.id;
});

const canReview = computed(() => auth.isAdmin && status.value === 'in_review');
const canArchive = computed(() => auth.isAdmin && status.value === 'approved');

function formatDate(d) {
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  return new Date(d).toLocaleString(loc);
}

async function runAction(action) {
  if (!props.sheet?.id || busy.value) return;

  if (action === 'reject' && !comment.value.trim()) {
    toast.warning(t('lifecycle.rejectNeedsComment'));
    return;
  }

  const confirmKeys = {
    submit: 'lifecycle.confirmSubmit',
    approve: 'lifecycle.confirmApprove',
    reject: 'lifecycle.confirmReject',
    archive: 'lifecycle.confirmArchive',
  };
  const ok = await confirm.confirm({
    title: t('lifecycle.confirmTitle'),
    message: t(confirmKeys[action]),
    confirmLabel: t('common.confirm'),
    variant: action === 'reject' ? 'danger' : 'default',
  });
  if (!ok) return;

  busy.value = true;
  try {
    const body = {
      comment: comment.value.trim() || null,
      order_number: orderNumber.value.trim() || null,
      batch_number: batchNumber.value.trim() || null,
    };
    const updated = await post(`/templates/${props.sheet.id}/${action}`, body);
    emit('updated', updated);
    toast.success(t(`lifecycle.${action}Success`));
    if (action === 'reject') comment.value = '';
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
