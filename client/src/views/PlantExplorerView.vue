<template>
  <div class="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col lg:flex-row lg:gap-0">
    <aside class="w-full shrink-0 border-b border-[var(--sapNeutralBorderColor)] lg:w-52 lg:border-b-0 lg:border-r">
      <div class="sap-object-header !py-3">
        <h1 class="text-base font-bold">{{ t('plantExplorer.title') }}</h1>
        <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('plantExplorer.subtitle') }}</p>
      </div>
      <ul class="p-2">
        <li v-for="p in plants" :key="p.code">
          <button
            type="button"
            class="w-full rounded px-3 py-2 text-left text-sm transition-colors"
            :class="
              selectedCode === p.code
                ? 'bg-[var(--sapList_SelectionBackgroundColor)] font-semibold'
                : 'hover:bg-[var(--sapList_Hover_Background)]'
            "
            @click="selectPlant(p.code)"
          >
            <span class="font-mono text-xs text-[var(--sapContentLabelColor)]">{{ p.code }}</span>
            <span class="ml-1">{{ p.name }}</span>
            <span class="mt-0.5 block text-xs text-[var(--sapContentLabelColor)]">
              {{ t('plantExplorer.sheetCount', { n: p.pi_sheet_count }) }}
            </span>
          </button>
        </li>
      </ul>
    </aside>

    <div v-if="loading" class="flex flex-1 items-center justify-center p-8 text-[var(--sapContentLabelColor)]">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="!detail" class="flex flex-1 items-center justify-center p-8 text-sm text-[var(--sapContentLabelColor)]">
      {{ t('plantExplorer.pickPlant') }}
    </div>

    <div v-else class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div class="border-b border-[var(--sapNeutralBorderColor)] p-4">
        <h2 class="text-lg font-bold">
          {{ detail.plant.code }} — {{ detail.plant.name }}
        </h2>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span class="rounded bg-slate-100 px-2 py-1">
            {{ t('plantExplorer.piSheets') }}: {{ detail.summary.pi_sheets }}
          </span>
          <span class="rounded bg-slate-100 px-2 py-1">
            {{ t('plantExplorer.materials') }}: {{ detail.summary.materials }}
          </span>
          <span class="rounded bg-slate-100 px-2 py-1">
            {{ t('plantExplorer.scales') }}: {{ detail.summary.scales }}
          </span>
          <span class="rounded bg-slate-100 px-2 py-1">
            {{ t('plantExplorer.sensors') }}: {{ detail.summary.sensors }}
          </span>
        </div>
      </div>

      <div class="flex border-b border-[var(--sapNeutralBorderColor)] px-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="border-b-2 px-4 py-2 text-sm"
          :class="
            activeTab === tab.id
              ? 'border-[var(--sapBrandColor)] font-semibold text-[var(--sapBrandColor)]'
              : 'border-transparent text-[var(--sapContentLabelColor)]'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <!-- PI Sheets -->
        <section v-if="activeTab === 'sheets'" class="space-y-2">
          <div
            v-for="s in detail.pi_sheets"
            :key="s.id"
            class="sap-tile flex flex-wrap items-center justify-between gap-2 p-3"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left hover:opacity-90"
              @click="openInChat(s.id)"
            >
              <p class="font-medium">{{ s.title }}</p>
              <p class="text-xs text-[var(--sapContentLabelColor)]">
                {{ s.process_type }} · {{ s.step_count }} {{ t('plantExplorer.steps') }}
                <span v-if="s.order_number"> · {{ t('lifecycle.orderNumber') }} {{ s.order_number }}</span>
              </p>
            </button>
            <div class="flex shrink-0 items-center gap-2">
              <PISheetStatusBadge :status="s.status" />
              <button
                type="button"
                class="sap-btn sap-btn--emphasized !text-sm"
                @click="openInChat(s.id)"
              >
                {{ t('plantExplorer.openInChat') }}
              </button>
            </div>
          </div>
          <p v-if="!detail.pi_sheets.length" class="text-sm text-[var(--sapContentLabelColor)]">
            {{ t('plantExplorer.noSheets') }}
          </p>
        </section>

        <!-- Materials -->
        <section v-if="activeTab === 'materials'" class="space-y-3">
          <details
            v-for="m in detail.materials"
            :key="m.id"
            class="sap-tile group"
            open
          >
            <summary class="cursor-pointer list-none p-3 font-medium">
              <span class="font-mono text-sm">{{ m.label }}</span>
              <span v-if="m.description" class="ml-2 text-xs font-normal text-[var(--sapContentLabelColor)]">
                {{ m.description }}
              </span>
              <span v-if="m.source === 'sap_bom'" class="ml-2 rounded bg-blue-100 px-1.5 text-xs text-blue-800">SAP</span>
              <span class="text-xs text-[var(--sapContentLabelColor)]">
                ({{ m.occurrences?.length || 0 }} {{ t('plantExplorer.inPiSheets') }})
              </span>
            </summary>
            <ul v-if="m.occurrences?.length" class="border-t px-3 pb-3 text-xs">
              <li v-for="(o, i) in m.occurrences" :key="i" class="py-1">
                {{ o.pi_sheet_title }} — {{ o.step_name }} ({{ o.xstep_id || '—' }})
              </li>
            </ul>
            <p v-else-if="m.quantity" class="border-t px-3 pb-3 text-xs text-[var(--sapContentLabelColor)]">
              {{ m.quantity }} {{ m.unit }}
            </p>
          </details>
        </section>

        <!-- Processes: XSteps, params, equipment -->
        <section v-if="activeTab === 'processes'" class="space-y-6">
          <div v-for="proc in detail.processes" :key="proc.process_type" class="sap-tile p-4">
            <h3 class="font-semibold">{{ proc.process_type }}</h3>
            <p v-if="proc.chain.length" class="mt-1 font-mono text-xs text-[var(--sapContentLabelColor)]">
              {{ proc.chain.join(' → ') }}
            </p>

            <div class="mt-4 space-y-2">
              <details
                v-for="xs in proc.xsteps"
                :key="xs.xstep_id"
                class="rounded border border-[var(--sapNeutralBorderColor)]"
              >
                <summary class="cursor-pointer px-3 py-2 text-sm font-medium">
                  {{ xs.order }}. {{ xs.name }}
                  <span class="ml-2 font-mono text-xs text-[var(--sapContentLabelColor)]">{{ xs.xstep_id }}</span>
                  <span v-if="xs.gmp_relevant" class="ml-1 text-xs text-red-700">GMP</span>
                </summary>
                <div class="border-t px-3 py-2 text-xs">
                  <p v-if="xs.sap_transaction" class="mb-2">
                    SAP: <span class="font-mono">{{ xs.sap_transaction }}</span>
                  </p>
                  <p v-if="xs.equipment_ids?.length" class="mb-2">
                    {{ t('plantExplorer.linkedEquipment') }}: {{ xs.equipment_ids.join(', ') }}
                  </p>
                  <table v-if="xs.params?.length" class="w-full">
                    <thead>
                      <tr class="text-[var(--sapContentLabelColor)]">
                        <th class="py-1 text-left">{{ t('preview.paramName') }}</th>
                        <th class="py-1 text-left">{{ t('preview.paramValue') }}</th>
                        <th class="py-1">{{ t('preview.paramRequired') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(p, pi) in xs.params" :key="pi">
                        <td class="py-1">{{ p.name }}</td>
                        <td class="py-1 font-mono">{{ p.type }}{{ p.unit ? ` (${p.unit})` : '' }}</td>
                        <td class="py-1 text-center">{{ p.required ? '✓' : '○' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div v-if="proc.equipment.scales?.length">
                <h4 class="text-xs font-semibold uppercase text-[var(--sapContentLabelColor)]">
                  {{ t('plantExplorer.scales') }}
                </h4>
                <ul class="mt-1 space-y-1 text-sm">
                  <li v-for="eq in proc.equipment.scales" :key="eq.equipment_id">
                    <span class="font-mono">{{ eq.equipment_id }}</span> — {{ eq.name }}
                    <span class="block text-xs text-[var(--sapContentLabelColor)]">{{ eq.location }}</span>
                  </li>
                </ul>
              </div>
              <div v-if="proc.equipment.sensors?.length">
                <h4 class="text-xs font-semibold uppercase text-[var(--sapContentLabelColor)]">
                  {{ t('plantExplorer.sensors') }}
                </h4>
                <ul class="mt-1 space-y-1 text-sm">
                  <li v-for="eq in proc.equipment.sensors" :key="eq.equipment_id">
                    <span class="font-mono">{{ eq.equipment_id }}</span> — {{ eq.name }}
                    <span
                      v-for="pp in (eq.process_parameters || []).slice(0, 3)"
                      :key="pp.name"
                      class="ml-1 text-xs text-[var(--sapContentLabelColor)]"
                    >
                      {{ pp.name }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- Equipment overview -->
        <section v-if="activeTab === 'equipment'" class="grid gap-4 lg:grid-cols-2">
          <div class="sap-tile p-4">
            <h3 class="mb-2 font-semibold">{{ t('plantExplorer.scales') }}</h3>
            <ul class="space-y-2 text-sm">
              <li v-for="eq in detail.equipment.scales" :key="eq.equipment_id">
                <span class="font-mono">{{ eq.equipment_id }}</span> — {{ eq.name }}
                <ul class="mt-1 text-xs text-[var(--sapContentLabelColor)]">
                  <li v-for="pp in eq.process_parameters" :key="pp.name">{{ pp.name }} ({{ pp.unit || '—' }})</li>
                </ul>
              </li>
            </ul>
          </div>
          <div class="sap-tile p-4">
            <h3 class="mb-2 font-semibold">{{ t('plantExplorer.sensors') }}</h3>
            <ul class="space-y-2 text-sm">
              <li v-for="eq in detail.equipment.sensors" :key="eq.equipment_id">
                <span class="font-mono">{{ eq.equipment_id }}</span> — {{ eq.name }}
                <ul class="mt-1 text-xs text-[var(--sapContentLabelColor)]">
                  <li v-for="pp in eq.process_parameters" :key="pp.name">{{ pp.name }} ({{ pp.unit || '—' }})</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { useOpenPiSheet } from '@/composables/useOpenPiSheet';
import PISheetStatusBadge from '@/components/pisheet/PISheetStatusBadge.vue';

const { openInChat } = useOpenPiSheet();

const { t } = useI18n();

const plants = ref([]);
const selectedCode = ref('CH01');
const detail = ref(null);
const loading = ref(true);
const activeTab = ref('processes');

const tabs = computed(() => [
  { id: 'processes', label: t('plantExplorer.tabProcesses') },
  { id: 'materials', label: t('plantExplorer.tabMaterials') },
  { id: 'sheets', label: t('plantExplorer.tabSheets') },
  { id: 'equipment', label: t('plantExplorer.tabEquipment') },
]);

async function loadOverview() {
  const res = await get('/plants');
  plants.value = res.plants || [];
  if (plants.value.length && !plants.value.find((p) => p.code === selectedCode.value)) {
    selectedCode.value = plants.value[0].code;
  }
}

async function selectPlant(code) {
  selectedCode.value = code;
  loading.value = true;
  try {
    detail.value = await get(`/plants/${code}`);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    await loadOverview();
    await selectPlant(selectedCode.value);
  } finally {
    loading.value = false;
  }
});
</script>
