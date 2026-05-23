<template>
  <div class="sap-login-page sap-shell--joule flex h-full max-h-[100dvh] flex-col overflow-auto bg-[var(--sapBackgroundColor)]">
    <header class="sap-shell-bar !shadow-none">
      <div class="sap-shell-bar__brand">
        <div class="sap-shell-bar__logo">SAP</div>
        <div>
          <p class="sap-shell-bar__title">{{ t('common.appName') }}</p>
          <p class="sap-shell-bar__subtitle">{{ t('login.subtitle') }}</p>
        </div>
      </div>
      <LanguageSwitcher />
    </header>

    <div class="flex flex-1 items-center justify-center p-6">
      <form class="sap-tile w-full max-w-md p-8" @submit.prevent="submit">
        <div class="mb-6 text-center">
          <AssistantRobot class="mx-auto mb-4" size="md" orb animated />
          <h1 class="text-xl font-bold text-[var(--sapTextColor)]">{{ t('login.signInTitle') }}</h1>
          <div
            class="mt-4 rounded border border-[var(--sapGroupContentBorderColor)] bg-[var(--sapGroupContentBackground)] px-4 py-3 text-left text-sm"
            role="note"
          >
            <p class="font-semibold text-[var(--sapTextColor)]">{{ t('login.demoTitle') }}</p>
            <ul class="mt-2 space-y-1 text-[var(--sapContentLabelColor)]">
              <li>
                <span class="font-medium text-[var(--sapTextColor)]">{{ t('common.roleAdmin') }}:</span>
                {{ t('login.demoAdmin') }}
              </li>
              <li>
                <span class="font-medium text-[var(--sapTextColor)]">{{ t('common.roleOperator') }}:</span>
                {{ t('login.demoOperator') }}
              </li>
              <li>
                <span class="font-medium text-[var(--sapTextColor)]">{{ t('common.rolePromptEditor') }}:</span>
                {{ t('login.demoPromptEditor') }}
              </li>
            </ul>
          </div>
        </div>

        <label class="mb-4 block">
          <span class="sap-label">{{ t('login.email') }}</span>
          <input
            v-model="email"
            type="email"
            required
            class="sap-input"
            placeholder="admin@pisheet.local"
          />
        </label>

        <label class="mb-4 block">
          <span class="sap-label">{{ t('login.password') }}</span>
          <input v-model="password" type="password" required class="sap-input" />
        </label>

        <p v-if="error" class="mb-3 text-sm text-[var(--sapErrorColor)]">{{ error }}</p>

        <button type="submit" class="sap-btn sap-btn--emphasized w-full !py-2.5" :disabled="loading">
          {{ loading ? t('login.submitting') : t('login.submit') }}
        </button>

        <p class="sap-message-strip mt-4">{{ t('login.gmpNotice') }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { get } from '@/composables/useApi';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue';
import AssistantRobot from '@/components/chat/AssistantRobot.vue';

const { t } = useI18n();
const email = ref('admin@pisheet.local');
const password = ref('admin123');
const error = ref('');
const loading = ref(false);
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

function resolveLoginError(err) {
  const apiDown =
    !err.response ||
    err.response.status === 503 ||
    err.response.data?.error === 'API_UNAVAILABLE';
  if (apiDown) {
    return t('login.apiUnreachable');
  }
  if (err.response.status === 429) {
    return t('login.rateLimited');
  }
  const msg = err.response.data?.error;
  if (msg === 'Invalid credentials') {
    return t('login.failed');
  }
  return msg || t('login.failed');
}

onMounted(async () => {
  try {
    await get('/health');
  } catch (e) {
    if (!e.response || e.response.status === 503 || e.response.data?.error === 'API_UNAVAILABLE') {
      error.value = t('login.apiUnreachable');
    }
  }
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = route.query.redirect || '/chat';
    router.push(redirect);
  } catch (e) {
    error.value = resolveLoginError(e);
  } finally {
    loading.value = false;
  }
}
</script>
