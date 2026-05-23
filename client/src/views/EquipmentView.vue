<template>
  <div>
    <div class="sap-object-header mb-4 !rounded-lg">
      <h1 class="text-xl font-bold">{{ t('equipmentPage.title') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.subtitle') }}</p>
    </div>

    <SkeletonBlock v-if="loading" :lines="10" wrapper-class="sap-tile p-4" />

    <template v-else>
      <EquipmentNamespaceSearch :equipment-options="items" />

      <div v-if="scales.length" class="sap-tile mb-6 p-4">
        <h2 class="text-sm font-bold">{{ t('equipmentPage.scalesOverview') }}</h2>
        <p class="mt-1 text-xs text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.scalesOverviewHint') }}</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="s in scales"
            :key="s.equipment_id"
            class="rounded-lg border border-[var(--sapNeutralBorderColor)] p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-semibold">{{ s.equipment_id }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="s.status?.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              >
                {{ s.status?.online ? t('equipmentPage.online') : t('equipmentPage.offline') }}
              </span>
            </div>
            <p class="mt-1 text-sm font-medium">{{ s.name }}</p>
            <p class="text-xs text-[var(--sapContentLabelColor)]">{{ s.location || '—' }}</p>
            <p class="mt-1 text-[10px] text-[var(--sapContentLabelColor)]">
              {{ connLabel(s.connection_type) }}
              <span v-if="s.connection_type === 'simulation'"> · {{ t('equipmentPage.simulation') }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="sap-tile p-4">
          <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.configured') }}</p>
          <p class="text-2xl font-bold text-[var(--sapBrandColor)]">{{ items.length }}</p>
        </div>
        <div class="sap-tile p-4">
          <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.online') }}</p>
          <p class="text-2xl font-bold text-green-700">{{ onlineCount }}</p>
        </div>
        <div class="sap-tile p-4">
          <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.offline') }}</p>
          <p class="text-2xl font-bold text-red-700">{{ offlineCount }}</p>
        </div>
        <div class="sap-tile p-4">
          <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.simulation') }}</p>
          <p class="text-2xl font-bold text-amber-700">{{ simCount }}</p>
        </div>
      </div>

      <div class="mb-4 flex justify-end">
        <button type="button" class="sap-btn sap-btn--emphasized" @click="openCreate">
          {{ t('equipmentPage.add') }}
        </button>
      </div>

      <div class="sap-tile overflow-hidden">
        <div class="space-y-3 p-3 md:hidden">
          <article
            v-for="row in items"
            :key="row.equipment_id"
            class="sap-mobile-card"
            @click="toggleExpand(row.equipment_id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-semibold">{{ row.equipment_id }}</span>
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="row.status?.online ? 'bg-green-500' : 'bg-red-500'"
              />
            </div>
            <p class="mt-1 font-medium">{{ row.name }}</p>
            <p class="text-xs text-[var(--sapContentLabelColor)]">{{ row.location || '—' }}</p>
            <div class="sap-mobile-card__actions" @click.stop>
              <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm" @click="openEdit(row)">
                {{ t('equipmentPage.edit') }}
              </button>
              <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm" @click="runTest(row)">
                {{ t('equipmentPage.test') }}
              </button>
              <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm text-red-700" @click="remove(row)">
                {{ t('equipmentPage.delete') }}
              </button>
            </div>
            <div v-if="expandedId === row.equipment_id" class="mt-3 border-t border-[var(--sapNeutralBorderColor)] pt-3" @click.stop>
              <p class="mb-2 text-xs font-semibold">{{ t('equipmentPage.liveTest') }}</p>
              <EquipmentLivePanel :equipment-id="row.equipment_id" :name="row.name" />
            </div>
          </article>
        </div>
        <div class="hidden md:block">
        <table class="w-full text-sm">
          <thead class="border-b bg-[var(--sapList_HeaderBackground)] text-left text-xs">
            <tr>
              <th class="p-3">{{ t('equipmentPage.colId') }}</th>
              <th class="p-3">{{ t('equipmentPage.colName') }}</th>
              <th class="p-3">{{ t('equipmentPage.colType') }}</th>
              <th class="p-3">{{ t('equipmentPage.colConnection') }}</th>
              <th class="p-3">{{ t('equipmentPage.colStatus') }}</th>
              <th class="p-3">{{ t('equipmentPage.colLocation') }}</th>
              <th class="p-3">{{ t('equipmentPage.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in items" :key="row.equipment_id">
              <tr
                class="cursor-pointer border-b hover:bg-[var(--sapList_Hover_Background)]"
                @click="toggleExpand(row.equipment_id)"
              >
                <td class="p-3 font-mono text-xs">{{ row.equipment_id }}</td>
                <td class="p-3">{{ row.name }}</td>
                <td class="p-3">{{ typeLabel(row.equipment_type) }}</td>
                <td class="p-3">
                  <EquipmentConnectionBadge
                    :connection-type="row.connection_type"
                    :is-online="row.status?.online"
                    :is-fallback="row.status?.fallback"
                  />
                </td>
                <td class="p-3">
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    :class="row.status?.online ? 'bg-green-500' : 'bg-red-500'"
                  />
                  {{ row.status?.online ? t('equipmentPage.online') : t('equipmentPage.offline') }}
                </td>
                <td class="p-3 text-[var(--sapContentLabelColor)]">{{ row.location || '—' }}</td>
                <td class="p-3" @click.stop>
                  <button type="button" class="sap-btn sap-btn--transparent !px-2 !py-1 !text-xs" @click="openEdit(row)">
                    {{ t('equipmentPage.edit') }}
                  </button>
                  <button
                    type="button"
                    class="sap-btn sap-btn--transparent !px-2 !py-1 !text-xs"
                    @click="runTest(row)"
                  >
                    {{ t('equipmentPage.test') }}
                  </button>
                  <button
                    type="button"
                    class="sap-btn sap-btn--transparent !px-2 !py-1 !text-xs text-red-700"
                    @click="remove(row)"
                  >
                    {{ t('equipmentPage.delete') }}
                  </button>
                </td>
              </tr>
              <tr v-if="expandedId === row.equipment_id">
                <td colspan="7" class="bg-[var(--sapBackgroundColor)] p-4">
                  <p class="mb-2 text-xs font-semibold">{{ t('equipmentPage.liveTest') }}</p>
                  <EquipmentLivePanel :equipment-id="row.equipment_id" :name="row.name" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        </div>
      </div>

      <p v-if="testMessage" class="mt-3 text-sm" :class="testOk ? 'text-green-700' : 'text-red-700'">
        {{ testMessage }}
      </p>
    </template>

    <div
      v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="modalOpen = false"
    >
      <form class="sap-tile max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" @submit.prevent="saveForm">
        <h2 class="mb-4 text-lg font-bold">{{ editing ? t('equipmentPage.edit') : t('equipmentPage.add') }}</h2>

        <label class="mb-3 block">
          <span class="sap-label">{{ t('equipmentPage.colId') }}</span>
          <input v-model="form.equipment_id" class="sap-input" :readonly="editing" required />
        </label>
        <label class="mb-3 block">
          <span class="sap-label">{{ t('equipmentPage.colName') }}</span>
          <input v-model="form.name" class="sap-input" required />
        </label>
        <label class="mb-3 block">
          <span class="sap-label">{{ t('equipmentPage.colType') }}</span>
          <select v-model="form.equipment_type" class="sap-input">
            <option v-for="tp in typeOptions" :key="tp" :value="tp">{{ typeLabel(tp) }}</option>
          </select>
        </label>
        <label class="mb-3 block">
          <span class="sap-label">{{ t('equipmentPage.colLocation') }}</span>
          <input v-model="form.location" class="sap-input" />
        </label>

        <fieldset class="mb-3">
          <legend class="sap-label mb-2">{{ t('equipmentPage.colConnection') }}</legend>
          <div class="flex flex-wrap gap-2">
            <label v-for="ct in connOptions" :key="ct" class="sap-tile flex cursor-pointer gap-2 p-2 !shadow-none">
              <input v-model="form.connection_type" type="radio" :value="ct" />
              <span class="text-xs">{{ connLabel(ct) }}</span>
            </label>
          </div>
        </fieldset>

        <div v-if="form.connection_type === 'simulation'" class="mb-3 grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-xs">{{ t('equipmentPage.updateRate') }}</span>
            <input v-model.number="form.connection_config.updateRate" type="number" class="sap-input" />
          </label>
          <label class="block">
            <span class="text-xs">{{ t('equipmentPage.noise') }}</span>
            <input v-model.number="form.connection_config.noise" type="number" step="0.0001" class="sap-input" />
          </label>
          <label class="col-span-2 block">
            <span class="text-xs">{{ t('equipmentPage.maxWeight') }}</span>
            <input v-model.number="form.connection_config.maxWeight" type="number" class="sap-input" />
          </label>
        </div>

        <div v-if="form.connection_type === 'opcua'" class="mb-3 space-y-2">
          <input v-model="form.connection_config.endpoint" class="sap-input" :placeholder="t('equipmentPage.endpoint')" />
          <input v-model="form.connection_config.nodePrefix" class="sap-input" :placeholder="t('equipmentPage.nodePrefix')" />
        </div>

        <div v-if="form.connection_type === 'mqtt'" class="mb-3 space-y-2">
          <input v-model="form.connection_config.broker" class="sap-input" :placeholder="t('equipmentPage.broker')" />
          <input v-model="form.connection_config.topicPrefix" class="sap-input" :placeholder="t('equipmentPage.topicPrefix')" />
        </div>

        <div v-if="form.connection_type === 'uns_sparkplug'" class="mb-3 space-y-2">
          <input v-model="form.connection_config.broker" class="sap-input" :placeholder="t('equipmentPage.broker')" />
          <input v-model="form.connection_config.groupId" class="sap-input" :placeholder="t('equipmentPage.groupId')" />
          <input v-model="form.connection_config.edgeNodeId" class="sap-input" :placeholder="t('equipmentPage.edgeNodeId')" />
          <input v-model="form.connection_config.deviceId" class="sap-input" :placeholder="t('equipmentPage.deviceId')" />
        </div>

        <div v-if="form.equipment_type === 'scale'" class="mb-3 grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-xs">{{ t('equipmentPage.maxCapacity') }}</span>
            <input v-model.number="form.scale_config.maxCapacity" type="number" class="sap-input" />
          </label>
          <label class="block">
            <span class="text-xs">{{ t('equipmentPage.resolution') }}</span>
            <input v-model.number="form.scale_config.resolution" type="number" step="0.00001" class="sap-input" />
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="sap-btn sap-btn--transparent" @click="modalOpen = false">
            {{ t('equipmentPage.cancel') }}
          </button>
          <button type="submit" class="sap-btn sap-btn--emphasized">{{ t('equipmentPage.save') }}</button>
        </div>
      </form>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, post, put, del } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import EquipmentConnectionBadge from '@/components/equipment/EquipmentConnectionBadge.vue';
import EquipmentNamespaceSearch from '@/components/equipment/EquipmentNamespaceSearch.vue';
import EquipmentLivePanel from '@/components/equipment/EquipmentLivePanel.vue';
import SkeletonBlock from '@/components/shared/SkeletonBlock.vue';

const { t } = useI18n();
const toast = useToast();
const confirmDialog = useConfirm();

const items = ref([]);
const loading = ref(true);
const expandedId = ref(null);
const modalOpen = ref(false);
const editing = ref(false);
const editId = ref(null);
const testMessage = ref('');
const testOk = ref(false);

const typeOptions = ['scale', 'temperature', 'barcode', 'ph_meter', 'timer'];
const connOptions = ['simulation', 'opcua', 'mqtt', 'uns_sparkplug'];

const emptyForm = () => ({
  equipment_id: '',
  name: '',
  equipment_type: 'scale',
  location: '',
  connection_type: 'simulation',
  connection_config: { updateRate: 100, noise: 0.002, maxWeight: 50 },
  scale_config: { maxCapacity: 50, resolution: 0.001, unit: 'kg', lastCalibration: '2025-12-01' },
  process_parameters: [],
  is_active: true,
});

const form = ref(emptyForm());

const onlineCount = computed(() => items.value.filter((i) => i.status?.online).length);
const offlineCount = computed(() => items.value.length - onlineCount.value);
const simCount = computed(
  () => items.value.filter((i) => i.connection_type === 'simulation' || i.status?.fallback).length
);

const scales = computed(() => items.value.filter((i) => i.equipment_type === 'scale'));

function typeLabel(tp) {
  const map = {
    scale: 'Waage',
    temperature: 'Temperatur',
    barcode: 'Barcode',
    ph_meter: 'pH',
    timer: 'Timer',
  };
  return map[tp] || tp;
}

function connLabel(ct) {
  const map = {
    simulation: t('equipmentPage.connSimulation'),
    opcua: t('equipmentPage.connOpcua'),
    mqtt: t('equipmentPage.connMqtt'),
    uns_sparkplug: t('equipmentPage.connUns'),
  };
  return map[ct] || ct;
}

async function load() {
  loading.value = true;
  try {
    items.value = await get('/equipment');
  } catch {
    toast.error(t('equipmentPage.loadFailed'));
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id;
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
    equipment_id: row.equipment_id,
    name: row.name,
    equipment_type: row.equipment_type,
    location: row.location || '',
    connection_type: row.connection_type,
    connection_config: { ...(row.connection_config || {}) },
    scale_config: { ...(row.scale_config || {}) },
    process_parameters: row.process_parameters || [],
    is_active: row.is_active !== false,
  };
  modalOpen.value = true;
}

async function saveForm() {
  try {
    if (editing.value) {
      await put(`/equipment/${editId.value}`, form.value);
    } else {
      await post('/equipment', form.value);
    }
    toast.success(t('equipmentPage.saved'));
    modalOpen.value = false;
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function remove(row) {
  const ok = await confirmDialog.confirm({
    title: t('equipmentPage.deleteTitle'),
    message: t('equipmentPage.deleteConfirm'),
    confirmLabel: t('repository.delete'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await del(`/equipment/${row.id}`);
    toast.success(t('equipmentPage.deleted'));
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || t('equipmentPage.deleteBlocked'));
  }
}

async function runTest(row) {
  testMessage.value = t('equipmentPage.testing');
  testOk.value = false;
  try {
    const res = await post(`/equipment/${row.id}/test`, {});
    const last = res.samples?.[res.samples.length - 1];
    const w = last?.values?.grossWeight ?? last?.values?.netWeight ?? 0;
    const stable = last?.values?.stable ? t('equipment.yes') : t('equipment.no');
    testOk.value = res.sampleCount > 0;
    testMessage.value = testOk.value
      ? t('equipmentPage.testOk', { weight: Number(w).toFixed(3), stable })
      : t('equipmentPage.testFail');
    await load();
  } catch (e) {
    testMessage.value = `${t('equipmentPage.testFail')}: ${e.response?.data?.error || e.message}`;
  }
}

onMounted(load);
</script>
