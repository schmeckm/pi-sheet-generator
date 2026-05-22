<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--sapNeutralBorderColor)] bg-gray-900 text-gray-100 shadow-lg"
    :class="expanded ? 'h-56' : 'h-9'"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold"
      @click="expanded = !expanded"
    >
      <span>{{ t('equipment.debugTitle') }} (OPC UA / MQTT / UNS)</span>
      <span class="text-[var(--sapContentLabelColor)]">{{ lines.length }} {{ t('equipment.debugLines') }}</span>
    </button>
    <div v-if="expanded" class="h-[calc(100%-2.25rem)] overflow-y-auto px-3 pb-2 font-mono text-[10px] leading-relaxed">
      <p v-if="!lines.length" class="text-gray-500">{{ t('equipment.debugEmpty') }}</p>
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="border-b border-gray-800 py-1"
      >
        <span class="text-gray-500">{{ formatTs(line.timestamp) }}</span>
        <span class="ml-2 text-cyan-400">{{ line.equipmentId }}</span>
        <span class="ml-1 text-amber-300">[{{ line.protocol || '?' }}/{{ line.direction }}]</span>
        <span v-if="line.topic" class="ml-1 text-green-400">{{ line.topic }}</span>
        <span v-if="line.field" class="ml-1">{{ line.field }}={{ line.value }}</span>
        <span v-else-if="line.values" class="ml-1 text-gray-300">{{ JSON.stringify(line.values) }}</span>
        <span v-if="line.raw" class="ml-1 block text-gray-500">raw: {{ truncate(line.raw) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';

const props = defineProps({
  equipmentId: { type: String, default: '' },
  pollMs: { type: Number, default: 1500 },
});

const { t, locale } = useI18n();
const expanded = ref(false);
const lines = ref([]);
let timer = null;

function formatTs(ts) {
  if (!ts) return '';
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  return new Date(ts).toLocaleTimeString(loc);
}

function truncate(s, max = 120) {
  const str = String(s);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

async function poll() {
  try {
    const params = { limit: 60 };
    if (props.equipmentId) params.equipment_id = props.equipmentId;
    const data = await get('/equipment/debug/log', { params });
    lines.value = data.items || [];
  } catch {
    /* ignore when not admin */
  }
}

onMounted(() => {
  poll();
  timer = setInterval(poll, props.pollMs);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

defineExpose({ refresh: poll });
</script>
