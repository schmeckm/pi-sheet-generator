<template>
  <footer class="sap-status-bar" role="contentinfo" :aria-label="t('statusBar.ariaLabel')">
    <div class="sap-status-bar__group">
      <span
        class="sap-status-bar__chip sap-status-bar__chip--health"
        :class="healthChipClass"
        :title="healthTitle"
      >
        <span class="sap-status-bar__dot" />
        {{ t('statusBar.health') }} · {{ healthLabel }}
      </span>

      <span class="sap-status-bar__sep" aria-hidden="true">·</span>
      <span
        class="sap-status-bar__chip"
        :class="dbOnline ? 'sap-status-bar__chip--ok' : 'sap-status-bar__chip--err'"
        :title="dbTitle"
      >
        {{ dbOnline ? t('statusBar.dbOk') : t('statusBar.dbDown') }}
      </span>

      <span class="sap-status-bar__sep" aria-hidden="true">·</span>
      <span
        class="sap-status-bar__chip"
        :class="llmOnline ? 'sap-status-bar__chip--ok' : 'sap-status-bar__chip--warn'"
        :title="llmTitle"
      >
        {{ llmOnline ? t('statusBar.llmOk') : t('statusBar.llmMissing') }}
      </span>

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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';

const { t, locale } = useI18n();
const auth = useAuthStore();

const health = ref(null);
const apiCheckedAt = ref(null);
const clock = ref('');
const now = ref(new Date());

let healthTimer = null;
let clockTimer = null;

const healthStatus = computed(() => {
  if (!health.value) return 'unknown';
  return health.value.status || 'unknown';
});

const dbOnline = computed(() => health.value?.checks?.database?.ok === true);
const llmOnline = computed(() => health.value?.checks?.llm?.ok === true);

const healthLabel = computed(() => {
  const map = {
    healthy: t('statusBar.healthHealthy'),
    degraded: t('statusBar.healthDegraded'),
    down: t('statusBar.healthDown'),
  };
  return map[healthStatus.value] || t('statusBar.healthUnknown');
});

const healthChipClass = computed(() => {
  if (healthStatus.value === 'healthy') return 'sap-status-bar__chip--ok';
  if (healthStatus.value === 'degraded') return 'sap-status-bar__chip--warn';
  if (healthStatus.value === 'down') return 'sap-status-bar__chip--err';
  return 'sap-status-bar__chip--muted';
});

const healthTitle = computed(() => {
  if (!apiCheckedAt.value) return t('statusBar.healthTooltipPending');
  return t('statusBar.healthTooltip', {
    db: dbOnline.value ? t('statusBar.dbOk') : t('statusBar.dbDown'),
    llm: llmOnline.value ? t('statusBar.llmOk') : t('statusBar.llmMissing'),
    time: formatTime(apiCheckedAt.value),
  });
});

const dbTitle = computed(() =>
  health.value?.checks?.database?.latencyMs != null
    ? `${t('statusBar.dbOk')} · ${health.value.checks.database.latencyMs} ms`
    : dbOnline.value
      ? t('statusBar.dbOk')
      : t('statusBar.dbDown')
);

const llmTitle = computed(() =>
  llmOnline.value ? t('statusBar.llmOk') : t('statusBar.llmMissing')
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
    health.value = await get('/health');
  } catch {
    health.value = { status: 'down', checks: { database: { ok: false }, llm: { ok: false } } };
  } finally {
    apiCheckedAt.value = new Date();
  }
}

onMounted(() => {
  updateClock();
  pollHealth();
  healthTimer = setInterval(pollHealth, 15000);
  clockTimer = setInterval(updateClock, 30000);
});

onUnmounted(() => {
  if (healthTimer) clearInterval(healthTimer);
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.sap-status-bar {
  flex-shrink: 0;
  height: var(--sapStatusBar_Height, 1.75rem);
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
  height: 1.25rem;
  border-radius: 9999px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sap-status-bar__chip--health {
  font-weight: 700;
}

.sap-status-bar__chip--ok {
  color: #c6f6d5;
}

.sap-status-bar__chip--warn {
  color: #fef08a;
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

.sap-status-bar__chip--warn .sap-status-bar__dot {
  background: #facc15;
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
