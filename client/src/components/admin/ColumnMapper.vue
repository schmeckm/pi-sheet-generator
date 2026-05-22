<template>
  <div class="space-y-3">
    <div
      v-for="col in columns"
      :key="col"
      class="grid grid-cols-2 items-center gap-4 rounded border p-3"
    >
      <span class="font-mono text-sm">{{ col }}</span>
      <select
        :value="mapping[col] || ''"
        class="rounded border px-2 py-1 text-sm"
        @change="update(col, $event.target.value)"
      >
        <option value="">— ignorieren —</option>
        <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  columns: { type: Array, default: () => [] },
  mapping: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:mapping']);

const fields = [
  'xstep_id',
  'name',
  'category',
  'process_type',
  'description',
  'sap_transaction',
  'movement_type',
  'gmp_relevant',
];

function update(col, value) {
  emit('update:mapping', { ...props.mapping, [col]: value || undefined });
}
</script>
