<template>
  <div class="rounded-lg border bg-white shadow-sm">
    <!-- Mobile cards -->
    <div v-if="xsteps.length" class="space-y-3 p-3 md:hidden">
      <article
        v-for="x in pageItems"
        :key="x.id"
        class="sap-mobile-card"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-mono text-xs text-[var(--sapContentLabelColor)]">{{ x.xstep_id }}</p>
            <p class="font-semibold">{{ x.name }}</p>
          </div>
          <input
            type="checkbox"
            class="sap-touch-target mt-1"
            :checked="selected.includes(x.id)"
            @change="toggle(x.id)"
          />
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <span class="rounded px-2 py-0.5 text-xs text-white" :class="categoryClass(x.category)">
            {{ x.category }}
          </span>
          <span v-if="x.sap_system" class="rounded px-2 py-0.5 text-xs font-semibold uppercase text-white" :class="sapSystemClass(x.sap_system)">
            {{ x.sap_system }}
          </span>
          <span v-if="x.gmp_relevant" class="rounded bg-red-100 px-2 text-xs text-red-800">GMP</span>
        </div>
        <div class="sap-mobile-card__row">
          <span class="sap-mobile-card__label">{{ t('repository.process') }}</span>
          <span>{{ x.process_type }}</span>
        </div>
        <div class="sap-mobile-card__actions">
          <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm" @click="$emit('edit', x)">
            {{ t('repository.edit') }}
          </button>
          <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm text-red-600" @click="$emit('delete', x)">
            {{ t('repository.delete') }}
          </button>
        </div>
      </article>
    </div>

    <!-- Desktop table -->
    <div class="hidden overflow-x-auto md:block">
    <table class="w-full text-left text-sm">
      <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
        <tr>
          <th class="p-3"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
          <th
            v-for="col in columns"
            :key="col.key"
            class="cursor-pointer p-3 select-none hover:text-gray-800"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
            <span v-if="sortKey === col.key" class="ml-1">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
          </th>
          <th class="p-3">{{ t('repository.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="x in pageItems" :key="x.id" class="border-b hover:bg-gray-50">
          <td class="p-3">
            <input type="checkbox" :value="x.id" :checked="selected.includes(x.id)" @change="toggle(x.id)" />
          </td>
          <td class="p-3 font-mono text-xs">{{ x.xstep_id }}</td>
          <td class="p-3">{{ x.name }}</td>
          <td class="p-3">
            <span class="rounded px-2 py-0.5 text-xs text-white" :class="categoryClass(x.category)">
              {{ x.category }}
            </span>
          </td>
          <td class="p-3">{{ x.process_type }}</td>
          <td class="p-3">
            <span
              v-if="x.sap_system"
              class="rounded px-2 py-0.5 text-xs font-semibold uppercase text-white"
              :class="sapSystemClass(x.sap_system)"
              :title="sapSystemTitle(x.sap_system)"
            >
              {{ x.sap_system }}
            </span>
            <span v-else class="text-xs text-gray-400">—</span>
          </td>
          <td class="p-3">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="tag in (x.tags || [])"
                :key="tag"
                class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700"
              >
                {{ tag }}
              </span>
            </div>
          </td>
          <td class="p-3">
            <span v-if="x.gmp_relevant" class="rounded bg-red-100 px-2 text-xs text-red-800">GMP</span>
          </td>
          <td class="p-3">
            <span
              class="inline-block h-5 w-9 rounded-full transition"
              :class="x.is_active ? 'bg-green-500' : 'bg-gray-300'"
              role="presentation"
            />
            {{ x.is_active ? t('repository.activeYes') : t('repository.activeNo') }}
          </td>
          <td class="p-3">{{ x.version }}</td>
          <td class="p-3">
            <button type="button" class="text-[var(--sapBrandColor)] hover:underline" @click="$emit('edit', x)">
              {{ t('repository.edit') }}
            </button>
            <button type="button" class="ml-2 text-red-600 hover:underline" @click="$emit('delete', x)">
              {{ t('repository.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    </div>

    <div v-if="!xsteps.length" class="p-10 text-center">
      <p class="text-[var(--sapContentLabelColor)]">{{ emptyMessage || t('repository.empty') }}</p>
      <slot name="empty-action" />
    </div>

    <div
      v-if="xsteps.length && totalPages > 1"
      class="flex flex-wrap items-center justify-between gap-2 border-t bg-gray-50 px-3 py-2 text-xs"
    >
      <label class="flex items-center gap-2">
        {{ t('repository.pageSize') }}
        <select :value="pageSize" class="sap-input !py-1 !text-xs" @change="onPageSize($event.target.value)">
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
      <div class="flex items-center gap-2">
        <button type="button" class="sap-btn sap-btn--transparent !text-xs" :disabled="page <= 1" @click="page -= 1">
          {{ t('repository.prev') }}
        </button>
        <span>{{ t('repository.pageOf', { page, total: totalPages }) }}</span>
        <button
          type="button"
          class="sap-btn sap-btn--transparent !text-xs"
          :disabled="page >= totalPages"
          @click="page += 1"
        >
          {{ t('repository.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  xsteps: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  emptyMessage: { type: String, default: '' },
});

const emit = defineEmits(['edit', 'delete', 'update:selected']);

const { t } = useI18n();

const sortKey = ref('xstep_id');
const sortDir = ref('asc');
const page = ref(1);
const pageSize = ref(25);

const columns = computed(() => [
  { key: 'xstep_id', label: 'XStep ID' },
  { key: 'name', label: t('repository.name') },
  { key: 'category', label: t('repository.category') },
  { key: 'process_type', label: t('repository.process') },
  { key: 'sap_system', label: t('repository.sapSystem') },
  { key: 'tags', label: t('repository.tags') },
  { key: 'gmp_relevant', label: 'GMP' },
  { key: 'is_active', label: t('repository.active') },
  { key: 'version', label: 'Version' },
]);

const sorted = computed(() => {
  const list = [...props.xsteps];
  const key = sortKey.value;
  list.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (typeof av === 'boolean') return (av === bv ? 0 : av ? -1 : 1) * (sortDir.value === 'asc' ? 1 : -1);
    return String(av ?? '').localeCompare(String(bv ?? ''), 'de') * (sortDir.value === 'asc' ? 1 : -1);
  });
  return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize.value)));

const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return sorted.value.slice(start, start + pageSize.value);
});

const allSelected = computed(
  () => pageItems.value.length > 0 && pageItems.value.every((x) => props.selected.includes(x.id))
);

watch(
  () => props.xsteps.length,
  () => {
    page.value = 1;
  }
);

function toggleSort(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

function onPageSize(val) {
  pageSize.value = Number(val);
  page.value = 1;
}

function categoryClass(cat) {
  const map = {
    Warenbewegung: 'bg-green-600',
    Rückmeldung: 'bg-[var(--sapBrandColor)]',
    Prozess: 'bg-orange-500',
    Qualität: 'bg-pink-600',
    Dokumentation: 'bg-purple-600',
  };
  return map[cat] || 'bg-gray-500';
}

function sapSystemClass(sys) {
  const map = {
    ewm: 'bg-indigo-600',
    mm: 'bg-amber-600',
    none: 'bg-slate-500',
  };
  return map[sys] || 'bg-gray-400';
}

function sapSystemTitle(sys) {
  const key = `repository.sapSystem${sys.charAt(0).toUpperCase() + sys.slice(1)}`;
  const translated = t(key);
  return translated === key ? sys : translated;
}

function toggle(id) {
  const next = props.selected.includes(id)
    ? props.selected.filter((s) => s !== id)
    : [...props.selected, id];
  emit('update:selected', next);
}

function toggleAll() {
  const ids = pageItems.value.map((x) => x.id);
  if (allSelected.value) {
    emit(
      'update:selected',
      props.selected.filter((id) => !ids.includes(id))
    );
  } else {
    emit('update:selected', [...new Set([...props.selected, ...ids])]);
  }
}
</script>
