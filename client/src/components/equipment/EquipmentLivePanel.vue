<template>
  <div class="max-w-md">
    <ScaleDisplay
      v-if="live"
      :gross="live.grossWeight"
      :net="live.netWeight"
      :tare="live.tareWeight"
      :unit="live.unit"
      :stable="live.stable"
      :equipment-name="name"
      :equipment-id="equipmentId"
    />
    <p class="mt-2 text-xs text-[var(--sapContentLabelColor)]">
      {{ t('equipmentPage.dataFrom', { source: live?.source || '—' }) }}
      · {{ tickCount }} updates
    </p>
    <div class="mt-2 flex flex-wrap gap-2">
      <button type="button" class="sap-btn sap-btn--transparent !text-xs" @click="cmd('tare')">
        {{ t('equipment.tare') }}
      </button>
      <button type="button" class="sap-btn sap-btn--transparent !text-xs" @click="cmd('addWeight', { amount: 5 })">
        {{ t('equipmentPage.addMaterialTest') }}
      </button>
      <button type="button" class="sap-btn sap-btn--transparent !text-xs" @click="cmd('reset')">
        {{ t('equipmentPage.reset') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEquipment } from '@/composables/useEquipment';
import ScaleDisplay from './ScaleDisplay.vue';

const props = defineProps({
  equipmentId: { type: String, required: true },
  name: { type: String, default: '' },
});

const { t } = useI18n();
const equipment = useEquipment();
const live = ref(null);
const tickCount = ref(0);
let unsub = null;

onMounted(() => {
  const sub = equipment.subscribe(props.equipmentId);
  unsub = sub.unsubscribe;
  watch(
    sub.live,
    (v) => {
      live.value = { ...v };
      tickCount.value = sub.tickCount.value;
    },
    { deep: true, immediate: true }
  );
});

onUnmounted(() => {
  if (unsub) unsub();
});

async function cmd(command, params = {}) {
  await equipment.sendCommand(props.equipmentId, command, params);
}
</script>
