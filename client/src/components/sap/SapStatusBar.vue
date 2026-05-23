<template>
  <footer class="sap-status-bar" role="contentinfo" :aria-label="t('statusBar.ariaLabel')">
    <div class="sap-status-bar__group">
      <span
        class="sap-status-bar__chip"
        :class="apiOnline ? 'sap-status-bar__chip--ok' : 'sap-status-bar__chip--err'"
        :title="apiTitle"
      >
        <span class="sap-status-bar__dot" />
        API · {{ apiOnline ? t('statusBar.online') : t('statusBar.offline') }}
      </span>

      <template v-if="auth.isAdmin">
        <span class="sap-status-bar__sep" aria-hidden="true">·</span>
        <span class="sap-status-bar__chip" :title="t('statusBar.equipmentTooltip')">
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M4 4h4v4H4zM12 4h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4z" />
          </svg>
          EQ
          <span class="text-green-300">{{ equipmentOnline }}</span>
          <span class="text-[var(--sapContentLabelColor)]">/</span>
          <span class="text-red-300">{{ equipmentOffline }}</span>
          <span v-if="equipmentSim" class="text-amber-300">· SIM {{ equipmentSim }}</span>
        </span>

        <span v-if="protocolChips.length" class="sap-status-bar__sep" aria-hidden="true">·</span>
        <span
          v-for="p in protocolChips"
          :key="p.key"
          class="sap-status-bar__chip"
          :class="p.online ? 'sap-status-bar__chip--ok' : 'sap-status-bar__chip--muted'"
          :title="p.tooltip"
        >
          <span class="sap-status-bar__dot" />
          {{ p.label }}
        </span>
      </template>
    </div>

    <div class="sap-status-bar__group sap-status-bar__group--end">
      <span v-if="auth.user" class="sap-status-bar__chip sap-status-bar__chip--muted">
        <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M10 10a3 3 0 100-6 3 3 0 000 6zM3.5 17a6.5 6.5 0 0113 0v.5h-13V17z"
          />
        </svg>
        {{ auth.user.name || auth.user.email }}
        <span class="sap-status-bar__role">{{ auth.user.role }}</span>
      </span>
      <span class="sap-status-bar__sep" aria-hidden="true">·</span>
      <span class="sap-status-bar__chip sap-status-bar__chip--muted">
        {{ locale.toUpperCase() }}
      </span>
      <span class="sap-status-bar__sep" aria-hidden="true">·</span>
      <span class="sap-status-bar__chip sap-status-bar__chip--muted" :title="nowTitle">
        {{ clock }}
      </span>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';

const { t, locale } = useI18n();
const auth = useAuthStore();

const apiOnline = ref(false);
const apiCheckedAt = ref(null);
const equipmentList = ref([]);
const clock = ref('');
const now = ref(new Date());

let healthTimer = null;
let equipmentTimer = null;
let clockTimer = null;

const PROTOCOL_LABELS = {
  opcua: 'OPC UA',
  mqtt: 'MQTT',
  uns_sparkplug: 'UNS',
  simulation: 'SIM',
};

const equipmentOnline = computed(
  () => equipmentList.value.filter((e) => e.status?.online).length
);
const equipmentOffline = computed(
  () => equipmentList.value.length - equipmentOnline.value
);
const equipmentSim = computed(
  () =>
    equipmentList.value.filter(
      (e) => e.connection_type === 'simulation' || e.status?.fallback
    ).length
);

const protocolChips = computed(() => {
  const buckets = new Map();
  for (const eq of equipmentList.value) {
    const type = eq.connection_type;
    if (!type || type === 'simulation') continue;
    if (!buckets.has(type)) buckets.set(type, { total: 0, online: 0 });
    const b = buckets.get(type);
    b.total += 1;
    if (eq.status?.online) b.online += 1;
  }
  return [...buckets.entries()].map(([key, val]) => ({
    key,
    label: `${PROTOCOL_LABELS[key] || key.toUpperCase()} ${val.online}/${val.total}`,
    online: val.online > 0,
    tooltip: t('statusBar.protocolTooltip', {
      protocol: PROTOCOL_LABELS[key] || key,
      online: val.online,
      total: val.total,
    }),
  }));
});

const apiTitle = computed(() =>
  apiCheckedAt.value
    ? t('statusBar.apiTooltip', { time: formatTime(apiCheckedAt.value) })
    : t('statusBar.apiTooltipPending')
);

const nowTitle = computed(() => now.value.toLocaleString(localeTag.value));
const localeTag = computed(() => (locale.value === 'en' ? 'en-GB' : 'de-DE'));

function formatTime(date) {
  return new Date(date).toLocaleTimeString(localeTag.value);
}

function updateClock() {
  now.value = new Date();
  clock.value = now.value.toLocaleTimeString(localeTag.value, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function pollHealth() {
  try {
    await get('/health');
    apiOnline.value = true;
  } catch {
    apiOnline.value = false;
  } finally {
    apiCheckedAt.value = new Date();
  }
}

async function pollEquipment() {
  if (!auth.isAdmin) {
    equipmentList.value = [];
    return;
  }
  try {
    const data = await get('/equipment');
    equipmentList.value = Array.isArray(data) ? data : [];
  } catch {
    equipmentList.value = [];
  }
}

watch(
  () => auth.isAuthenticated,
  (val) => {
    if (val) pollEquipment();
    else equipmentList.value = [];
  }
);

watch(
  () => auth.isAdmin,
  () => pollEquipment()
);

onMounted(() => {
  updateClock();
  pollHealth();
  pollEquipment();
  healthTimer = setInterval(pollHealth, 15000);
  equipmentTimer = setInterval(pollEquipment, 20000);
  clockTimer = setInterval(updateClock, 30000);
});

onUnmounted(() => {
  if (healthTimer) clearInterval(healthTimer);
  if (equipmentTimer) clearInterval(equipmentTimer);
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.sap-status-bar {
  flex-shrink: 0;
  height: var(--sapStatusBar_Height, 1.5rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.75rem;
  background: var(--sapShellColor, #354a5f);
  color: var(--sapShell_TextColor, #fff);
  border-top: 1px solid var(--sapShellBorderColor, rgba(255, 255, 255, 0.1));
  font-size: 0.6875rem;
  line-height: 1;
  z-index: 60;
  user-select: none;
}

.sap-status-bar__group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
}

.sap-status-bar__group--end {
  justify-content: flex-end;
  flex-shrink: 0;
}

.sap-status-bar__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.375rem;
  height: 1.125rem;
  border-radius: 9999px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sap-status-bar__chip--ok {
  color: #c6f6d5;
}

.sap-status-bar__chip--err {
  color: #fed7d7;
}

.sap-status-bar__chip--muted {
  color: rgba(255, 255, 255, 0.72);
  font-weight: 500;
}

.sap-status-bar__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
}

.sap-status-bar__chip--err .sap-status-bar__dot {
  background: #fc8181;
}

.sap-status-bar__chip--ok .sap-status-bar__dot {
  background: #68d391;
}

.sap-status-bar__sep {
  color: rgba(255, 255, 255, 0.35);
}

.sap-status-bar__role {
  text-transform: uppercase;
  font-size: 0.625rem;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  background: #1c2733;
  color: #ffffff;
  letter-spacing: 0.04em;
  font-weight: 700;
}
</style>
