<template>
  <div>
    <div class="sap-object-header mb-4 flex flex-wrap items-end justify-between gap-4 !rounded-lg">
      <div>
        <h1 class="text-xl font-bold">{{ t('admin.repositoryTitle') }}</h1>
        <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('repository.subtitle') }}</p>
      </div>
      <div class="flex gap-2">
        <router-link to="/admin/upload" class="sap-btn sap-btn--transparent">{{ t('nav.upload') }}</router-link>
        <button type="button" class="sap-btn sap-btn--emphasized" @click="openCreate">{{ t('repository.new') }}</button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <input v-model="search" class="sap-input w-full sm:max-w-xs" :placeholder="t('repository.search')" @keyup.enter="reload" />
      <select v-model="filterProcess" class="sap-input w-full sm:max-w-[160px]" @change="reload">
        <option value="">{{ t('repository.allProcesses') }}</option>
        <option v-for="p in processTypes" :key="p" :value="p">{{ p }}</option>
      </select>
      <select v-model="filterSapSystem" class="sap-input max-w-[180px]" @change="reload">
        <option value="">{{ t('repository.sapSystemAll') }}</option>
        <option v-for="opt in sapSystemOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <input
        v-model="filterTags"
        class="sap-input max-w-[200px]"
        :placeholder="t('repository.tagsFilterPlaceholder')"
        @keyup.enter="reload"
      />
      <select v-model="filterGmp" class="sap-input max-w-[120px]" @change="reload">
        <option value="">{{ t('repository.gmpAll') }}</option>
        <option value="true">GMP</option>
        <option value="false">—</option>
      </select>
      <button type="button" class="sap-btn sap-btn--transparent" @click="reload">{{ t('repository.apply') }}</button>
    </div>

    <div v-if="selected.length" class="sap-message-strip mb-3 flex flex-wrap items-center gap-2">
      <span>{{ t('repository.selected', { count: selected.length }) }}</span>
      <button type="button" class="sap-btn sap-btn--transparent !text-xs" @click="bulk('activate')">{{ t('repository.activate') }}</button>
      <button type="button" class="sap-btn sap-btn--transparent !text-xs" @click="bulk('deactivate')">{{ t('repository.deactivate') }}</button>
      <button type="button" class="sap-btn sap-btn--transparent !text-xs text-red-700" @click="bulk('delete')">{{ t('repository.delete') }}</button>
    </div>

    <SkeletonBlock v-if="repo.loading" :lines="8" wrapper-class="sap-tile p-6" />

    <XStepTable
      v-else
      v-model:selected="selected"
      :xsteps="repo.xsteps"
      :empty-message="search ? t('repository.noSearchResults', { query: search }) : ''"
      @edit="openEdit"
      @delete="remove"
    >
      <template v-if="!repo.xsteps.length && !search" #empty-action>
        <router-link to="/admin/upload" class="sap-btn sap-btn--emphasized mt-4 inline-block">
          {{ t('nav.upload') }}
        </router-link>
      </template>
    </XStepTable>

    <p class="mt-2 text-sm text-[var(--sapContentLabelColor)]">
      {{ t('repository.total', { count: repo.total }) }}
    </p>

    <div
      v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="modalOpen = false"
    >
      <form class="sap-tile max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" @submit.prevent="save">
        <h2 class="mb-4 text-lg font-bold">{{ editing ? t('repository.edit') : t('repository.new') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="sap-label">XStep ID</span>
            <input v-model="form.xstep_id" class="sap-input" :readonly="editing" required />
          </label>
          <label class="block sm:col-span-2">
            <span class="sap-label">{{ t('repository.name') }}</span>
            <input v-model="form.name" class="sap-input" required />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('repository.category') }}</span>
            <select v-model="form.category" class="sap-input">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="block">
            <span class="sap-label">{{ t('repository.process') }}</span>
            <input v-model="form.process_type" class="sap-input" required />
          </label>
          <label class="block">
            <span class="sap-label">{{ t('repository.sapSystem') }}</span>
            <select v-model="form.sap_system" class="sap-input">
              <option :value="null">{{ t('repository.sapSystemUnspecified') }}</option>
              <option v-for="opt in sapSystemOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="sap-label">{{ t('repository.tags') }}</span>
            <input
              v-model="tagsInput"
              class="sap-input"
              :placeholder="t('repository.tagsPlaceholder')"
            />
          </label>
          <label class="block sm:col-span-2">
            <span class="sap-label">{{ t('repository.description') }}</span>
            <textarea v-model="form.description" class="sap-textarea" rows="2" />
          </label>
          <label class="block sm:col-span-2">
            <span class="sap-label">{{ t('repository.instruction') }}</span>
            <textarea v-model="form.instruction_template" class="sap-textarea" rows="3" />
          </label>
          <label class="flex items-center gap-2">
            <input v-model="form.gmp_relevant" type="checkbox" />
            <span>GMP</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="form.signature_required" type="checkbox" />
            <span>{{ t('repository.signature') }}</span>
          </label>
          <label class="flex items-center gap-2 sm:col-span-2">
            <input v-model="form.is_active" type="checkbox" />
            <span>{{ t('repository.active') }}</span>
          </label>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="sap-btn sap-btn--transparent" @click="modalOpen = false">{{ t('equipmentPage.cancel') }}</button>
          <button type="submit" class="sap-btn sap-btn--emphasized">{{ t('equipmentPage.save') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRepositoryStore } from '@/stores/repository';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import XStepTable from '@/components/admin/XStepTable.vue';
import SkeletonBlock from '@/components/shared/SkeletonBlock.vue';

const { t } = useI18n();
const repo = useRepositoryStore();
const toast = useToast();
const confirm = useConfirm();

const search = ref('');
const filterProcess = ref('');
const filterGmp = ref('');
const filterSapSystem = ref('');
const filterTags = ref('');
const selected = ref([]);
const modalOpen = ref(false);
const editing = ref(false);
const editId = ref(null);

const processTypes = ['Verpackung', 'Abfüllung', 'Granulation', 'Tablettierung', 'Coating'];
const categories = ['Warenbewegung', 'Rückmeldung', 'Prozess', 'Qualität', 'Dokumentation'];

const sapSystemOptions = computed(() => [
  { value: 'ewm', label: t('repository.sapSystemEwm') },
  { value: 'mm', label: t('repository.sapSystemMm') },
  { value: 'none', label: t('repository.sapSystemNone') },
  { value: 'unspecified', label: t('repository.sapSystemUnspecified') },
]);

const emptyForm = () => ({
  xstep_id: '',
  name: '',
  category: 'Prozess',
  process_type: 'Verpackung',
  description: '',
  instruction_template: '',
  params: [],
  sap_system: null,
  tags: [],
  gmp_relevant: false,
  signature_required: false,
  is_active: true,
});

const form = ref(emptyForm());

const tagsInput = computed({
  get: () => (Array.isArray(form.value.tags) ? form.value.tags.join(', ') : ''),
  set: (val) => {
    form.value.tags = String(val || '')
      .split(/[,;|]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  },
});

function reload() {
  const params = { limit: 500, page: 1 };
  if (search.value) params.search = search.value;
  if (filterProcess.value) params.process_type = filterProcess.value;
  if (filterGmp.value) params.gmp_relevant = filterGmp.value;
  if (filterSapSystem.value) params.sap_system = filterSapSystem.value;
  if (filterTags.value.trim()) params.tags = filterTags.value.trim();
  repo.loadXSteps(params);
}

function openCreate() {
  editing.value = false;
  editId.value = null;
  form.value = emptyForm();
  modalOpen.value = true;
}

function openEdit(row) {
  editing.value = true;
  editId.value = row.id;
  form.value = {
    ...row,
    params: row.params || [],
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    sap_system: row.sap_system || null,
  };
  modalOpen.value = true;
}

async function save() {
  try {
    if (editing.value) await repo.updateXStep(editId.value, form.value);
    else await repo.createXStep(form.value);
    toast.success(t('repository.saved'));
    modalOpen.value = false;
    reload();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function remove(row) {
  const ok = await confirm.confirm({
    title: t('repository.deleteTitle'),
    message: t('repository.deleteConfirm'),
    confirmLabel: t('repository.delete'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await repo.deleteXStep(row.id);
    toast.success(t('repository.deleted'));
    reload();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function bulk(action) {
  if (action === 'delete') {
    const ok = await confirm.confirm({
      title: t('repository.bulkDeleteTitle'),
      message: t('repository.bulkDeleteConfirm', { count: selected.value.length }),
      confirmLabel: t('repository.delete'),
      variant: 'danger',
    });
    if (!ok) return;
  }
  try {
    await repo.bulkAction(action, selected.value);
    selected.value = [];
    toast.success(t('repository.bulkDone'));
    reload();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

onMounted(reload);
</script>
