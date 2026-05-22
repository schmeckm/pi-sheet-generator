<template>
  <span
    class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
    :class="badgeClass"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="dotClass" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  connectionType: { type: String, default: 'simulation' },
  isOnline: { type: Boolean, default: false },
  isFallback: { type: Boolean, default: false },
});

const label = computed(() => {
  if (props.isFallback) return 'SIM (Fallback)';
  const map = {
    simulation: 'SIM',
    opcua: 'OPC UA',
    mqtt: 'MQTT',
    uns_sparkplug: 'UNS',
  };
  return map[props.connectionType] || props.connectionType;
});

const badgeClass = computed(() => {
  if (props.isFallback) return 'bg-amber-100 text-amber-900';
  const map = {
    simulation: 'bg-amber-100 text-amber-800',
    opcua: 'bg-blue-100 text-blue-800',
    mqtt: 'bg-purple-100 text-purple-800',
    uns_sparkplug: 'bg-teal-100 text-teal-800',
  };
  return map[props.connectionType] || 'bg-gray-100 text-gray-700';
});

const dotClass = computed(() =>
  props.isOnline ? 'bg-green-500' : 'bg-red-500'
);
</script>
