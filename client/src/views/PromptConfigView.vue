<template>
  <div class="prompt-config">
    <div class="sap-object-header mb-4 flex flex-wrap items-end justify-between gap-4 !rounded-lg">
      <div>
        <h1 class="text-xl font-bold">{{ t('admin.promptsTitle') }}</h1>
        <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('promptConfig.subtitle') }}</p>
        <p
          v-if="!auth.isAdmin"
          class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          {{ t('promptConfig.editorRoleHint') }}
        </p>
      </div>
      <button type="button" class="sap-btn sap-btn--emphasized" @click="openCreateDialog">
        {{ t('promptConfig.new') }}
      </button>
    </div>

    <SkeletonBlock v-if="loading" :lines="10" wrapper-class="sap-tile p-6" />

    <div v-else class="grid min-h-[calc(100vh-10rem)] gap-4 lg:grid-cols-[minmax(240px,280px)_1fr]">
      <!-- Config list -->
      <aside class="sap-tile flex flex-col overflow-hidden p-0">
        <div class="border-b border-[var(--sapNeutralBorderColor)] px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-[var(--sapContentLabelColor)]">
            {{ t('promptConfig.listTitle') }}
          </p>
          <p class="mt-0.5 text-[10px] text-[var(--sapContentLabelColor)]">
            {{ t('promptConfig.listCount', { n: prompts.length }) }}
          </p>
        </div>
        <ul class="flex-1 overflow-y-auto p-2">
          <li v-for="p in prompts" :key="p.id">
            <button
              type="button"
              class="mb-1 w-full rounded-lg px-3 py-2.5 text-left transition"
              :class="
                active?.id === p.id
                  ? 'bg-[var(--sapHighlightColor)] ring-1 ring-[var(--sapBrandColor)]'
                  : 'hover:bg-[var(--sapBackgroundColor)]'
              "
              @click="select(p)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-semibold">{{ p.name }}</span>
                <span
                  v-if="p.is_active"
                  class="shrink-0 rounded-full bg-[var(--sapSuccessColor)] px-2 py-0.5 text-[10px] font-medium text-white"
                >
                  {{ t('promptConfig.active') }}
                </span>
              </div>
              <p class="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--sapContentLabelColor)]">
                {{ excerpt(p.system_prompt) }}
              </p>
              <p class="mt-1 text-[10px] text-[var(--sapContentLabelColor)]">{{ formatDate(p.updated_at) }}</p>
            </button>
          </li>
        </ul>
      </aside>

      <!-- Editor panel -->
      <section v-if="active" class="sap-tile flex min-h-0 flex-col overflow-hidden p-0">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sapNeutralBorderColor)] px-4 py-3"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-lg font-bold">{{ active.name }}</h2>
              <span
                v-if="active.is_active"
                class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
              >
                {{ t('promptConfig.active') }}
              </span>
              <span
                v-if="isDirty"
                class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
              >
                {{ t('promptConfig.unsaved') }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-[var(--sapContentLabelColor)]">
              {{ t('promptConfig.meta', { chars: charCount, lines: lineCount }) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="!active.is_active && auth.isAdmin"
              type="button"
              class="sap-btn sap-btn--transparent"
              @click="activate"
            >
              {{ t('promptConfig.activate') }}
            </button>
            <button
              type="button"
              class="sap-btn sap-btn--emphasized"
              :disabled="!isDirty || saving"
              :title="t('promptConfig.saveShortcut')"
              @click="save"
            >
              {{ saving ? t('common.loading') : t('equipmentPage.save') }}
            </button>
          </div>
        </div>

        <div class="flex gap-1 border-b border-[var(--sapNeutralBorderColor)] px-4 pt-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="rounded-t-md px-4 py-2 text-sm font-medium transition"
            :class="
              panel === tab.id
                ? 'border border-b-0 border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] text-[var(--sapBrandColor)]'
                : 'text-[var(--sapContentLabelColor)] hover:bg-[var(--sapBackgroundColor)]'
            "
            @click="panel = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <PromptEditor
            v-show="panel === 'editor'"
            :key="active.id"
            v-model="editPrompt"
            class="min-h-0 flex-1"
            :dirty="isDirty"
            :saving="saving"
            :saved-baseline="savedPrompt"
            @save="save"
            @revert="revertEdits"
          />

          <div v-show="panel === 'history'" class="min-h-0 flex-1 overflow-y-auto">
            <p v-if="!history.length" class="rounded-lg border border-dashed p-8 text-center text-sm text-[var(--sapContentLabelColor)]">
              {{ t('promptConfig.historyEmpty') }}
            </p>
            <ul v-else class="space-y-2">
              <li
                v-for="h in history"
                :key="h.id"
                class="rounded-lg border border-[var(--sapNeutralBorderColor)] p-3 text-sm"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-medium text-[var(--sapTextColor)]">
                    {{ t('promptConfig.versionLabel', { n: h.version_number || '?' }) }}
                    · {{ formatDate(h.created_at) }}
                  </span>
                  <span class="text-xs text-[var(--sapContentLabelColor)]">
                    {{ h.user?.name || h.user?.email || '—' }}
                  </span>
                </div>
                <p class="mt-2 font-mono text-xs leading-relaxed text-[var(--sapContentLabelColor)]">
                  {{ h.excerpt }}{{ h.excerpt && h.char_count > 200 ? '…' : '' }}
                </p>
                <p class="mt-1 text-[10px] text-[var(--sapContentLabelColor)]">
                  {{ t('promptConfig.historyChars', { n: h.char_count || 0 }) }}
                </p>
                <button
                  v-if="h.system_prompt"
                  type="button"
                  class="sap-btn sap-btn--transparent mt-2 !py-1 text-xs"
                  @click="restoreFromHistory(h)"
                >
                  {{ t('promptConfig.restoreVersion') }}
                </button>
              </li>
            </ul>
          </div>

          <PromptComparePanel
            v-show="panel === 'compare'"
            :prompt-id="active.id"
            :versions="history"
            :locale="locale === 'en' ? 'en' : 'de'"
            class="min-h-0 flex-1"
          />

          <div v-show="panel === 'test'" class="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('promptConfig.testHint') }}</p>
            <fieldset class="space-y-2">
              <legend class="sap-label">{{ t('promptConfig.testModeTitle') }}</legend>
              <div class="flex flex-wrap gap-3 text-sm">
                <label v-for="opt in testModeOptions" :key="opt.value" class="flex cursor-pointer items-center gap-2">
                  <input v-model="testMode" type="radio" class="accent-[var(--sapBrandColor)]" :value="opt.value" />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
              <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('promptConfig.testModeHint') }}</p>
            </fieldset>
            <label class="block">
              <span class="sap-label">{{ t('promptConfig.testTitle') }}</span>
              <textarea
                v-model="testPrompt"
                class="sap-textarea mt-1 min-h-[80px]"
                :placeholder="testPlaceholder"
              />
            </label>
            <button
              type="button"
              class="sap-btn sap-btn--emphasized"
              :disabled="testing || testPrompt.trim().length < 10"
              @click="runTest"
            >
              {{ testing ? t('promptConfig.testing') : t('promptConfig.test') }}
            </button>
            <div
              v-if="testResult"
              class="overflow-hidden rounded-lg border border-[var(--sapNeutralBorderColor)]"
            >
              <div class="border-b bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300">
                {{ testResultLabel }}
              </div>
              <pre
                class="max-h-80 overflow-auto p-4 text-xs leading-relaxed whitespace-pre-wrap"
                :class="testResultMode === 'qa' ? 'bg-slate-50 text-[var(--sapTextColor)]' : 'bg-slate-900 text-green-400'"
              >{{ testResult }}</pre>
            </div>
            <TokenUsageLine v-if="testUsage" :usage="testUsage" />
          </div>
        </div>
      </section>

      <section
        v-else
        class="sap-tile flex flex-col items-center justify-center gap-3 p-12 text-center text-[var(--sapContentLabelColor)]"
      >
        <p class="text-sm">{{ loadError ? t('promptConfig.loadFailed') : t('promptConfig.selectHint') }}</p>
        <button
          v-if="loadError"
          type="button"
          class="sap-btn sap-btn--emphasized"
          @click="load"
        >
          {{ t('promptConfig.retry') }}
        </button>
      </section>
    </div>

    <!-- New config dialog -->
    <div
      v-if="createOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="createOpen = false"
    >
      <form class="sap-tile w-full max-w-md p-6" @submit.prevent="createNew">
        <h2 class="text-lg font-bold">{{ t('promptConfig.new') }}</h2>
        <label class="mt-4 block">
          <span class="sap-label">{{ t('promptConfig.newName') }}</span>
          <input v-model="newName" class="sap-input mt-1" required placeholder="z. B. verpackung-v2" />
        </label>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="sap-btn sap-btn--transparent" @click="createOpen = false">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="sap-btn sap-btn--emphasized">{{ t('promptConfig.create') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, post, put } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import SkeletonBlock from '@/components/shared/SkeletonBlock.vue';
import PromptEditor from '@/components/admin/PromptEditor.vue';
import PromptComparePanel from '@/components/admin/PromptComparePanel.vue';
import TokenUsageLine from '@/components/shared/TokenUsageLine.vue';

const { t, locale } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const prompts = ref([]);
const loadError = ref('');
const loading = ref(true);
const saving = ref(false);
const active = ref(null);
const savedPrompt = ref('');
const editPrompt = ref('');
const panel = ref('editor');
const testPrompt = ref('');
const testMode = ref('auto');
const testResult = ref('');
const testResultMode = ref('');
const testUsage = ref(null);
const testing = ref(false);
const history = ref([]);
const createOpen = ref(false);
const newName = ref('');

const tabs = computed(() => [
  { id: 'editor', label: t('promptConfig.tabEditor') },
  { id: 'history', label: t('promptConfig.tabHistory') },
  { id: 'compare', label: t('promptConfig.tabCompare') },
  { id: 'test', label: t('promptConfig.tabTest') },
]);

const charCount = computed(() => editPrompt.value.length);
const lineCount = computed(() => (editPrompt.value ? editPrompt.value.split('\n').length : 0));
const isDirty = computed(() => active.value && editPrompt.value !== savedPrompt.value);

const testModeOptions = computed(() => [
  { value: 'auto', label: t('promptConfig.testModeAuto') },
  { value: 'pi_sheet', label: t('promptConfig.testModePiSheet') },
  { value: 'qa', label: t('promptConfig.testModeQa') },
]);

const testPlaceholder = computed(() => {
  if (testMode.value === 'qa') return t('promptConfig.testPlaceholderQa');
  if (testMode.value === 'pi_sheet') return t('promptConfig.testPlaceholder');
  return t('promptConfig.testPlaceholderAuto');
});

const testResultLabel = computed(() => {
  if (testResultMode.value === 'qa') return t('promptConfig.testResultQa');
  if (testResultMode.value === 'pi_sheet') return t('promptConfig.testResultPiSheet');
  return t('promptConfig.testResult');
});

function formatDate(d) {
  if (!d) return '';
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  return new Date(d).toLocaleString(loc);
}

function excerpt(text) {
  if (!text) return '—';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await get('/admin/prompts');
    prompts.value = Array.isArray(data) ? data : [];
    if (!prompts.value.length) {
      loadError.value = t('promptConfig.emptyList');
      active.value = null;
      return;
    }
    const pick =
      prompts.value.find((p) => p.id === active.value?.id) ||
      prompts.value.find((p) => p.is_active) ||
      prompts.value[0];
    await select(pick, { skipDirtyCheck: true });
  } catch (e) {
    loadError.value = e.response?.data?.error || e.message || t('promptConfig.loadFailed');
    toast.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

async function loadHistory(id) {
  try {
    history.value = await get(`/admin/prompts/${id}/versions`);
  } catch {
    history.value = [];
  }
}

async function ensurePromptText(p) {
  const text = p?.system_prompt;
  if (text && String(text).trim().length > 0) return text;
  try {
    const data = await get('/admin/prompts/default-template');
    toast.warning(t('promptConfig.emptyLoadedDefault'));
    return data.system_prompt || '';
  } catch {
    return '';
  }
}

async function select(p, opts = {}) {
  if (!opts.skipDirtyCheck && isDirty.value) {
    const ok = await confirm.confirm({
      title: t('promptConfig.unsaved'),
      message: t('promptConfig.discardConfirm'),
      confirmLabel: t('promptConfig.revert'),
      variant: 'danger',
    });
    if (!ok) return;
  }
  active.value = p;
  const text = await ensurePromptText(p);
  editPrompt.value = text;
  savedPrompt.value = text;
  testResult.value = '';
  panel.value = 'editor';
  loadHistory(p.id);
}

async function revertEdits() {
  const ok = await confirm.confirm({
    title: t('promptConfig.revert'),
    message: t('promptConfig.revertConfirm'),
    confirmLabel: t('promptConfig.revert'),
    variant: 'danger',
  });
  if (ok) editPrompt.value = savedPrompt.value;
}

async function save() {
  saving.value = true;
  try {
    await put(`/admin/prompts/${active.value.id}`, { system_prompt: editPrompt.value });
    savedPrompt.value = editPrompt.value;
    toast.success(t('promptConfig.saved'));
    await loadHistory(active.value.id);
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    saving.value = false;
  }
}

async function activate() {
  try {
    await put(`/admin/prompts/${active.value.id}/activate`);
    toast.success(t('promptConfig.activated'));
    await load();
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

function openCreateDialog() {
  newName.value = '';
  createOpen.value = true;
}

async function createNew() {
  const name = newName.value.trim();
  if (!name) return;
  try {
    await post('/admin/prompts', {
      name,
      system_prompt: editPrompt.value || t('promptConfig.defaultDraft'),
    });
    createOpen.value = false;
    toast.success(t('promptConfig.created'));
    await load();
    const created = prompts.value.find((p) => p.name === name);
    if (created) select(created);
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function restoreFromHistory(entry) {
  const text = entry?.system_prompt || entry?.previous_prompt;
  if (!text) return;
  if (panel.value !== 'editor') panel.value = 'editor';
  if (isDirty.value) {
    const ok = await confirm.confirm({
      title: t('promptConfig.restoreVersion'),
      message: t('promptConfig.restoreConfirm'),
      confirmLabel: t('promptConfig.restoreVersion'),
      variant: 'danger',
    });
    if (!ok) return;
  }
  editPrompt.value = text;
  toast.success(t('promptConfig.restoredHint'));
}

async function runTest() {
  if (testPrompt.value.trim().length < 10) return;
  testing.value = true;
  testResult.value = '';
  testResultMode.value = '';
  testUsage.value = null;
  try {
    const payload = {
      test_prompt: testPrompt.value,
      mode: testMode.value,
      locale: locale.value === 'en' ? 'en' : 'de',
    };
    // B4: when the editor has unsaved changes, test against the draft.
    if (isDirty.value && editPrompt.value && editPrompt.value.trim().length >= 20) {
      payload.system_prompt_override = editPrompt.value;
    }
    const res = await post(`/admin/prompts/${active.value.id}/test`, payload);
    testResultMode.value = res.mode || 'pi_sheet';
    testUsage.value = res.usage || res.piSheet?.llm_usage || null;
    if (res.mode === 'qa') {
      testResult.value = res.message || '';
    } else {
      testResult.value = JSON.stringify(res.raw || res.piSheet?.llm_response || res, null, 2);
    }
  } catch (e) {
    testResultMode.value = 'error';
    testResult.value = e.response?.data?.error || e.message;
  } finally {
    testing.value = false;
  }
}

function onGlobalSave(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && panel.value === 'editor' && isDirty.value && !saving.value) {
    e.preventDefault();
    save();
  }
}

onMounted(() => {
  load();
  globalThis.addEventListener('keydown', onGlobalSave);
});

onUnmounted(() => {
  globalThis.removeEventListener('keydown', onGlobalSave);
});
</script>
