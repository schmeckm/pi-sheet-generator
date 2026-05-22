<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div
      class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] px-3 py-2"
    >
      <button
        type="button"
        class="sap-btn sap-btn--emphasized !py-1.5 text-xs"
        :disabled="!dirty || saving"
        :title="t('promptConfig.saveShortcut')"
        @click="$emit('save')"
      >
        {{ saving ? t('common.loading') : t('equipmentPage.save') }}
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !py-1.5 text-xs"
        :disabled="!dirty"
        @click="$emit('revert')"
      >
        {{ t('promptConfig.revert') }}
      </button>
      <span class="hidden h-5 w-px bg-[var(--sapNeutralBorderColor)] sm:inline" />
      <select
        v-model="jumpSection"
        class="sap-input max-w-[12rem] !py-1.5 text-xs"
        @change="onJumpSection"
      >
        <option value="">{{ t('promptConfig.jumpSection') }}</option>
        <option v-for="s in sections" :key="s.line" :value="s.line">
          {{ s.label }}
        </option>
      </select>
      <select
        v-model="snippetKey"
        class="sap-input max-w-[11rem] !py-1.5 text-xs"
        @change="onInsertSnippet"
      >
        <option value="">{{ t('promptConfig.insertSnippet') }}</option>
        <option v-for="sn in snippetOptions" :key="sn.key" :value="sn.key">
          {{ sn.label }}
        </option>
      </select>
      <button type="button" class="sap-btn sap-btn--transparent !py-1.5 text-xs" @click="loadDefault">
        {{ t('promptConfig.loadDefault') }}
      </button>
      <button type="button" class="sap-btn sap-btn--transparent !py-1.5 text-xs" @click="copyAll">
        {{ copied ? t('promptConfig.copied') : t('promptConfig.copy') }}
      </button>
      <span class="ml-auto text-[11px] tabular-nums text-[var(--sapContentLabelColor)]">
        {{ t('promptConfig.meta', { chars: charCount, lines: lineCount }) }}
      </span>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !p-1.5"
        :title="t('promptConfig.fullscreen')"
        @click="fullscreen = true"
      >
        <span class="text-base leading-none" aria-hidden="true">⛶</span>
      </button>
    </div>

    <div class="flex gap-1">
      <button
        v-for="v in viewOptions"
        :key="v.id"
        type="button"
        class="rounded-md px-3 py-1.5 text-xs font-medium transition"
        :class="
          editorView === v.id
            ? 'bg-[var(--sapBrandColor)] text-white'
            : 'bg-[var(--sapBackgroundColor)] text-[var(--sapContentLabelColor)] hover:text-[var(--sapTextColor)]'
        "
        @click="editorView = v.id"
      >
        {{ v.label }}
      </button>
    </div>

    <div class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_minmax(200px,240px)]">
      <div class="flex min-h-0 flex-col">
        <span class="sap-label mb-1">{{ t('promptConfig.systemPromptLabel') }}</span>

        <div
          v-show="editorView === 'edit'"
          class="relative flex min-h-[min(60vh,520px)] flex-1 overflow-hidden rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)]"
        >
          <div
            ref="gutterRef"
            class="hidden w-10 shrink-0 select-none overflow-hidden border-r border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] py-3 pr-1 text-right font-mono text-[11px] leading-relaxed text-[var(--sapContentLabelColor)] sm:block"
            aria-hidden="true"
          >
            <div v-for="n in lineCount" :key="n" class="h-[1.625rem]">{{ n }}</div>
          </div>
          <textarea
            ref="textareaRef"
            :value="modelValue"
            class="min-h-0 w-full flex-1 resize-y border-0 bg-transparent px-3 py-3 font-mono text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--sapBrandColor)]"
            spellcheck="false"
            :placeholder="t('promptConfig.editorPlaceholder')"
            @input="onInput"
            @keydown="onKeydown"
            @scroll="syncGutterScroll"
          />
        </div>

        <div
          v-show="editorView === 'preview'"
          class="prompt-md-preview min-h-[min(60vh,520px)] flex-1 overflow-y-auto rounded-lg border border-[var(--sapNeutralBorderColor)] bg-white px-4 py-3 text-sm text-[var(--sapTextColor)]"
          v-html="previewHtml"
        />

        <div
          v-show="editorView === 'diff'"
          class="min-h-[min(60vh,520px)] flex-1 overflow-auto rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] font-mono text-[12px] leading-relaxed"
        >
          <p v-if="!dirty" class="p-4 text-[var(--sapContentLabelColor)]">{{ t('promptConfig.diffEmpty') }}</p>
          <div v-for="(row, i) in diffRows" v-else :key="i" class="flex gap-2 border-b border-[var(--sapNeutralBorderColor)]/50 px-2 py-0.5">
            <span class="w-8 shrink-0 text-[var(--sapContentLabelColor)]">{{ row.oldLine || '' }}</span>
            <span class="w-8 shrink-0 text-[var(--sapContentLabelColor)]">{{ row.newLine || '' }}</span>
            <span
              class="w-5 shrink-0 font-bold"
              :class="{
                'text-green-700': row.type === 'add',
                'text-red-700': row.type === 'remove',
                'text-[var(--sapContentLabelColor)]': row.type === 'same',
              }"
            >{{ row.type === 'add' ? '+' : row.type === 'remove' ? '−' : ' ' }}</span>
            <span class="min-w-0 flex-1 whitespace-pre-wrap break-all">{{ row.line }}</span>
          </div>
        </div>
      </div>

      <aside class="flex flex-col gap-2 lg:max-h-[min(60vh,520px)]">
        <details class="rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)]">
          <summary
            class="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--sapTextColor)] marker:content-none [&::-webkit-details-marker]:hidden"
          >
            <span class="flex items-center justify-between gap-2">
              {{ t('promptConfig.hintsTitle') }}
              <span class="text-[var(--sapContentLabelColor)]">▾</span>
            </span>
          </summary>
          <ul class="space-y-1.5 border-t border-[var(--sapNeutralBorderColor)] px-3 py-2 text-xs text-[var(--sapContentLabelColor)]">
            <li>{{ t('promptConfig.hint1') }}</li>
            <li>{{ t('promptConfig.hint2') }}</li>
            <li>{{ t('promptConfig.hint3') }}</li>
            <li>{{ t('promptConfig.hint4') }}</li>
          </ul>
        </details>
        <p class="text-[10px] leading-snug text-[var(--sapContentLabelColor)]">
          {{ t('promptConfig.editorHelp') }}
        </p>
      </aside>
    </div>

    <Teleport to="body">
      <div
        v-if="fullscreen"
        class="fixed inset-0 z-[90] flex flex-col bg-[var(--sapGroupContentBackground)]"
      >
        <div
          class="flex flex-wrap items-center gap-2 border-b border-[var(--sapNeutralBorderColor)] px-4 py-3"
        >
          <span class="text-sm font-semibold">{{ t('promptConfig.fullscreenTitle') }}</span>
          <span
            v-if="dirty"
            class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
          >
            {{ t('promptConfig.unsaved') }}
          </span>
          <div class="ml-auto flex gap-2">
            <button
              type="button"
              class="sap-btn sap-btn--emphasized !py-1.5 text-xs"
              :disabled="!dirty || saving"
              @click="$emit('save'); fullscreen = false"
            >
              {{ t('equipmentPage.save') }}
            </button>
            <button type="button" class="sap-btn sap-btn--transparent !py-1.5 text-xs" @click="fullscreen = false">
              {{ t('promptConfig.exitFullscreen') }}
            </button>
          </div>
        </div>
        <textarea
          ref="fullscreenRef"
          :value="modelValue"
          class="min-h-0 flex-1 resize-none border-0 bg-transparent px-6 py-4 font-mono text-[14px] leading-relaxed outline-none"
          spellcheck="false"
          @input="onInput"
          @keydown="onKeydown"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { useConfirm } from '@/composables/useConfirm';
import { useToast } from '@/composables/useToast';
import { renderSimpleMarkdown } from '@/utils/simpleMarkdown';
import { diffLines } from '@/utils/lineDiff';

const props = defineProps({
  modelValue: { type: String, default: '' },
  savedBaseline: { type: String, default: '' },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'save', 'revert']);

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const textareaRef = ref(null);
const gutterRef = ref(null);
const fullscreenRef = ref(null);
const fullscreen = ref(false);
const jumpSection = ref('');
const snippetKey = ref('');
const copied = ref(false);
const editorView = ref('edit');

watch(
  () => props.modelValue,
  (v, prev) => {
    if (!prev && v) editorView.value = 'edit';
  }
);

const viewOptions = computed(() => [
  { id: 'edit', label: t('promptConfig.viewEdit') },
  { id: 'preview', label: t('promptConfig.viewPreview') },
  { id: 'diff', label: t('promptConfig.viewDiff') },
]);

const previewHtml = computed(() => renderSimpleMarkdown(props.modelValue));
const diffRows = computed(() => {
  if (!props.dirty) return [];
  return diffLines(props.savedBaseline, props.modelValue);
});

const charCount = computed(() => props.modelValue.length);
const lineCount = computed(() => (props.modelValue ? props.modelValue.split('\n').length : 1));

const sections = computed(() => {
  const lines = props.modelValue.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^#{1,3}\s+(.+)$/);
    if (m) found.push({ line: i, label: m[1].trim().slice(0, 48) });
  }
  return found;
});

const snippetOptions = computed(() => [
  { key: 'role', label: t('promptConfig.snippetRole') },
  { key: 'modus1', label: t('promptConfig.snippetModus1') },
  { key: 'modus2', label: t('promptConfig.snippetModus2') },
  { key: 'gmp', label: t('promptConfig.snippetGmp') },
  { key: 'json', label: t('promptConfig.snippetJson') },
  { key: 'equipment', label: t('promptConfig.snippetEquipment') },
]);

const SNIPPETS = {
  role: `# Rolle

Du bist ein Senior-Experte für SAP Manufacturing, PI Sheets und GMP in der pharmazeutischen Produktion.

`,
  modus1: `## Modus 1 — PI Sheet erstellen

- Antworte ausschließlich mit gültigem JSON (kein Markdown außerhalb).
- Operatorenanweisungen auf Deutsch.

`,
  modus2: `## Modus 2 — Informationsfrage / Equipment

- Natürliche Sprache; Equipment-Tools nutzen.
- Kein JSON, außer der Benutzer verlangt ein PI Sheet.

`,
  gmp: `## GMP — Pflichten

- Linienclearance, IPC, Dokumentation, Signaturhinweise bei Qualitätsschritten.
- Repository-XSteps bevorzugen; Ergänzungen mit is_suggestion: true.

`,
  json: `## JSON-Ausgabe (nur Modus 1)

{
  "title": "",
  "process_type": "",
  "description": "",
  "steps": [],
  "notes": [],
  "warnings": []
}

`,
  equipment: `## Equipment-Tools (nur Modus 2)

- list_equipment — konfigurierte Geräte
- search_industrial_namespace — OPC UA / UNS / MQTT
- discover_equipment_parameters, read_equipment_value

`,
};

function syncGutterScroll(e) {
  if (gutterRef.value) gutterRef.value.scrollTop = e.target.scrollTop;
}

function onInput(e) {
  emit('update:modelValue', e.target.value);
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (props.dirty && !props.saving) emit('save');
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    insertAtCursor('  ');
  }
}

function activeTextarea() {
  return fullscreen.value ? fullscreenRef.value : textareaRef.value;
}

function insertAtCursor(text) {
  const el = activeTextarea();
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = props.modelValue;
  const next = value.slice(0, start) + text + value.slice(end);
  emit('update:modelValue', next);
  const pos = start + text.length;
  nextTick(() => {
    el.focus();
    el.setSelectionRange(pos, pos);
  });
}

function onJumpSection() {
  const line = Number(jumpSection.value);
  jumpSection.value = '';
  if (Number.isNaN(line)) return;
  const el = activeTextarea();
  if (!el) return;
  const lines = props.modelValue.split('\n');
  let pos = 0;
  for (let i = 0; i < line && i < lines.length; i += 1) {
    pos += lines[i].length + 1;
  }
  nextTick(() => {
    el.focus();
    el.setSelectionRange(pos, pos);
    const lineHeight = 26;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 3);
  });
}

function onInsertSnippet() {
  const key = snippetKey.value;
  snippetKey.value = '';
  if (!key || !SNIPPETS[key]) return;
  insertAtCursor(SNIPPETS[key]);
}

async function loadDefault() {
  const ok = await confirm.confirm({
    title: t('promptConfig.loadDefault'),
    message: t('promptConfig.loadDefaultConfirm'),
    confirmLabel: t('promptConfig.loadDefault'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    const data = await get('/admin/prompts/default-template');
    emit('update:modelValue', data.system_prompt || '');
    toast.success(t('promptConfig.defaultLoaded'));
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  }
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(props.modelValue);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    toast.error(t('promptConfig.copyFailed'));
  }
}

watch(fullscreen, async (open) => {
  if (open) {
    await nextTick();
    fullscreenRef.value?.focus();
  }
});
</script>
