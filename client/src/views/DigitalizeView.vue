<template>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ t('digitalize.title') }}</h1>
      <p class="text-sm text-gray-600">{{ t('digitalize.subtitle') }}</p>
    </header>

    <!-- Step indicator -->
    <ol class="mb-8 flex flex-wrap gap-2 sm:gap-4">
      <li
        v-for="(label, i) in stepLabels"
        :key="i"
        class="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
        :class="
          wizardStep === i + 1
            ? 'bg-blue-600 text-white'
            : wizardStep > i + 1
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500'
        "
      >
        <span class="font-semibold">{{ i + 1 }}</span>
        <span class="hidden sm:inline">{{ label }}</span>
      </li>
    </ol>

    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div class="mb-4 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            class="h-full bg-blue-600 transition-all duration-500"
            :style="{ width: `${loadingProgress}%` }"
          />
        </div>
        <p class="text-center font-medium text-gray-900">{{ loadingMessage }}</p>
        <p class="mt-1 text-center text-sm text-gray-500">{{ loadingPhase }}</p>
      </div>
    </div>

    <!-- STEP 1: UPLOAD -->
    <section v-if="wizardStep === 1" class="space-y-6">
      <div
        class="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition hover:border-blue-400 hover:bg-blue-50/30"
        :class="dragOver ? 'border-blue-500 bg-blue-50' : ''"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <span class="text-5xl" aria-hidden="true">📷</span>
        <p class="mt-4 text-lg font-medium text-gray-800">
          {{ t('digitalize.uploadHint') }}
        </p>
        <p class="mt-1 text-sm text-gray-500">{{ t('digitalize.maxSize') }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-3 text-2xl">
          <span title="JPG">🖼️</span>
          <span title="PNG">🖼️</span>
          <span title="PDF">📄</span>
          <span title="DOCX">📝</span>
          <span title="XLSX">📊</span>
        </div>
        <p class="mt-2 text-xs text-gray-400">JPG · PNG · PDF · DOCX · XLSX</p>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,image/jpeg,image/png,application/pdf"
          @change="onFileChange"
        />
      </div>

      <div v-if="selectedFile" class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-start gap-4">
          <img
            v-if="localPreviewUrl"
            :src="localPreviewUrl"
            alt="Vorschau"
            class="max-h-40 rounded border object-contain"
          />
          <div v-else class="flex h-24 w-24 items-center justify-center rounded border bg-gray-100 text-3xl">
            📄
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ selectedFile.name }}</p>
            <p class="text-sm text-gray-500">
              {{ formatBytes(selectedFile.size) }}
            </p>
          </div>
          <button
            type="button"
            class="text-sm text-red-600 hover:underline"
            @click="clearFile"
          >
            {{ t('digitalize.removeFile') }}
          </button>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="!selectedFile"
          @click="runAnalyze"
        >
          {{ t('digitalize.analyze') }}
        </button>
      </div>
    </section>

    <!-- STEP 2: ANALYSE -->
    <section v-else-if="wizardStep === 2 && analyzeResult" class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-lg border bg-white p-3">
          <h2 class="mb-2 text-sm font-semibold text-gray-700">
            {{ t('digitalize.originalDoc') }}
          </h2>
          <div class="flex max-h-[480px] items-center justify-center overflow-auto rounded bg-gray-100 p-2">
            <img
              v-if="docPreviewUrl"
              :src="docPreviewUrl"
              alt="Original"
              class="max-h-[440px] max-w-full object-contain"
            />
            <p v-else class="p-8 text-center text-sm text-gray-500">
              {{ t('digitalize.noPreview') }}
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <span
              class="rounded-full px-3 py-1 text-sm font-medium"
              :class="qualityBadgeClass"
            >
              {{ qualityLabel }}
            </span>
          </div>

          <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-gray-500">{{ t('digitalize.metaTitle') }}</dt>
              <dd class="font-medium">{{ analyzeResult.recognized?.title || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">{{ t('digitalize.metaProcess') }}</dt>
              <dd class="font-medium">{{ analyzeResult.recognized?.process_type || '—' }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-gray-500">{{ t('digitalize.metaProduct') }}</dt>
              <dd class="font-medium">
                {{ analyzeResult.recognized?.metadata?.product || '—' }}
              </dd>
            </div>
          </dl>

          <ul
            v-if="analyzeResult.quality?.issues?.length"
            class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <li v-for="(issue, i) in analyzeResult.quality.issues" :key="i">⚠ {{ issue }}</li>
          </ul>

          <h3 class="font-semibold">{{ t('digitalize.recognizedSteps') }}</h3>
          <ul class="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            <li
              v-for="step in analyzeResult.recognized?.steps || []"
              :key="step.step_nr"
              class="rounded-lg border bg-white p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-gray-700">{{ step.step_nr }}.</span>
                <span class="font-medium">{{ step.name }}</span>
                <span
                  class="rounded px-2 py-0.5 text-xs text-white"
                  :class="categoryBadgeClass(step.category_guess)"
                >
                  {{ step.category_guess }}
                </span>
              </div>
              <div class="mt-2">
                <div class="flex justify-between text-xs text-gray-500">
                  <span>{{ t('digitalize.confidence') }}</span>
                  <span>{{ Math.round((step.confidence || 0) * 100) }}%</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    class="h-full bg-blue-500 transition-all"
                    :style="{ width: `${(step.confidence || 0) * 100}%` }"
                  />
                </div>
              </div>
              <ul v-if="step.params?.length" class="mt-2 text-xs text-gray-600">
                <li v-for="(p, pi) in step.params" :key="pi">
                  {{ p.name }}: {{ p.value || '—' }}{{ p.unit ? ` ${p.unit}` : '' }}
                </li>
              </ul>
              <p class="mt-2 text-xs text-gray-500">
                {{ matchHintForAnalyzeStep(step) }}
              </p>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex justify-between gap-3">
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          @click="wizardStep = 1"
        >
          {{ t('digitalize.back') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700"
          @click="runGenerate"
        >
          {{ t('digitalize.generate') }}
        </button>
      </div>
    </section>

    <!-- STEP 3: REVIEW -->
    <section v-else-if="wizardStep === 3 && piSheet" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm hover:bg-green-100"
          @click="supplementGmpSteps"
        >
          {{ t('digitalize.addGmp') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm hover:bg-blue-100"
          @click="applyRepositoryParams"
        >
          {{ t('digitalize.applyRepoParams') }}
        </button>
      </div>

      <div class="mb-2 flex flex-wrap gap-3 text-xs text-gray-600">
        <span><span class="inline-block h-3 w-3 rounded border-2 border-green-500" /> {{ t('digitalize.legendMatched') }}</span>
        <span><span class="inline-block h-3 w-3 rounded border-2 border-amber-500" /> {{ t('digitalize.legendPossible') }}</span>
        <span><span class="inline-block h-3 w-3 rounded border-2 border-red-500" /> {{ t('digitalize.legendNew') }}</span>
      </div>

      <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div class="min-h-[400px] rounded-lg border">
          <PISheetPreview :sheet="piSheet" show-match-borders hide-toolbar class="h-full min-h-[400px]" />
        </div>

        <aside class="space-y-3 overflow-y-auto max-h-[600px]">
          <h3 class="text-sm font-semibold">{{ t('digitalize.stepActions') }}</h3>
          <div
            v-for="step in sortedReviewSteps"
            :key="step.step_nr"
            class="rounded-lg border-2 p-3 text-sm"
            :class="reviewCardBorder(step)"
          >
            <p class="font-medium">{{ step.step_nr }}. {{ step.name }}</p>
            <label class="mt-2 block text-xs text-gray-500">{{ t('digitalize.assignXstep') }}</label>
            <input
              v-model="xstepSearch[step.step_nr]"
              type="search"
              class="mt-1 w-full rounded border px-2 py-1 text-xs"
              :placeholder="t('digitalize.searchXstep')"
              @input="searchXsteps(step.step_nr)"
            />
            <select
              v-if="xstepOptions[step.step_nr]?.length"
              class="mt-1 w-full rounded border px-2 py-1 text-xs"
              @change="assignXstep(step.step_nr, $event.target.value)"
            >
              <option value="">{{ t('digitalize.selectXstep') }}</option>
              <option
                v-for="xs in xstepOptions[step.step_nr]"
                :key="xs.xstep_id"
                :value="xs.xstep_id"
              >
                {{ xs.xstep_id }} — {{ xs.name }}
              </option>
            </select>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                class="text-xs text-blue-600 hover:underline"
                @click="startEditStep(step)"
              >
                {{ t('digitalize.edit') }}
              </button>
              <button
                type="button"
                class="text-xs text-red-600 hover:underline"
                @click="removeStep(step.step_nr)"
              >
                {{ t('digitalize.remove') }}
              </button>
            </div>
            <div v-if="editingStepNr === step.step_nr" class="mt-2 space-y-2">
              <input v-model="editDraft.name" class="w-full rounded border px-2 py-1 text-xs" />
              <textarea
                v-model="editDraft.instruction"
                rows="2"
                class="w-full rounded border px-2 py-1 text-xs"
              />
              <button
                type="button"
                class="rounded bg-gray-800 px-2 py-1 text-xs text-white"
                @click="saveEditStep"
              >
                {{ t('digitalize.saveEdit') }}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div class="flex justify-between">
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-sm"
          @click="wizardStep = 2"
        >
          {{ t('digitalize.back') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700"
          @click="wizardStep = 4"
        >
          {{ t('digitalize.continueConfirm') }}
        </button>
      </div>
    </section>

    <!-- STEP 4: CONFIRM -->
    <section v-else-if="wizardStep === 4 && piSheet" class="space-y-6">
      <div class="min-h-[480px] rounded-lg border">
        <PISheetPreview :sheet="piSheet" class="h-full min-h-[480px]" />
      </div>

      <label class="flex items-center gap-2 text-sm">
        <input v-model="addNewXsteps" type="checkbox" class="rounded" />
        {{ t('digitalize.addNewToRepo') }}
      </label>

      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          :disabled="saving"
          @click="saveTemplate"
        >
          {{ t('digitalize.saveTemplate') }}
        </button>
        <button
          type="button"
          class="rounded-lg border px-5 py-2.5 font-medium hover:bg-gray-50 disabled:opacity-50"
          :disabled="!savedSheetId"
          @click="downloadPdf"
        >
          {{ t('digitalize.downloadPdf') }}
        </button>
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-sm"
          @click="resetWizard"
        >
          {{ t('digitalize.newDoc') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, get, post } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import PISheetPreview from '@/components/pisheet/PISheetPreview.vue';

const { t, locale } = useI18n();
const toast = useToast();

const stepLabels = computed(() => [
  t('digitalize.stepUpload'),
  t('digitalize.stepAnalyze'),
  t('digitalize.stepReview'),
  t('digitalize.stepConfirm'),
]);

const wizardStep = ref(1);
const fileInput = ref(null);
const selectedFile = ref(null);
const localPreviewUrl = ref(null);
const dragOver = ref(false);

const analyzeResult = ref(null);
const generateResult = ref(null);
const piSheet = ref(null);
const matchesByStep = ref({});

const loading = ref(false);
const loadingMessage = ref('');
const loadingPhase = ref('');
const loadingProgress = ref(0);

const xstepSearch = reactive({});
const xstepOptions = reactive({});
const editingStepNr = ref(null);
const editDraft = reactive({ name: '', instruction: '' });
const addNewXsteps = ref(false);
const saving = ref(false);
const savedSheetId = ref(null);

const ACCEPTED_EXT = /\.(jpe?g|png|pdf|docx|xlsx)$/i;
const MAX_BYTES = 20 * 1024 * 1024;

const docPreviewUrl = computed(() => localPreviewUrl.value);

const qualityLabel = computed(() => {
  const q = analyzeResult.value?.quality?.image_quality || 'medium';
  if (q === 'good') return `🟢 ${t('digitalize.qualityGood')}`;
  if (q === 'poor') return `🔴 ${t('digitalize.qualityPoor')}`;
  return `🟡 ${t('digitalize.qualityMedium')}`;
});

const qualityBadgeClass = computed(() => {
  const q = analyzeResult.value?.quality?.image_quality || 'medium';
  if (q === 'good') return 'bg-green-100 text-green-800';
  if (q === 'poor') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
});

const sortedReviewSteps = computed(() =>
  [...(piSheet.value?.steps || [])].sort((a, b) => a.step_nr - b.step_nr)
);

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryBadgeClass(cat) {
  const map = {
    Warenbewegung: 'bg-green-600',
    Rückmeldung: 'bg-blue-600',
    Prozess: 'bg-orange-500',
    Qualität: 'bg-pink-600',
    Dokumentation: 'bg-purple-600',
  };
  return map[cat] || 'bg-gray-500';
}

function reviewCardBorder(step) {
  const s = step.match_status;
  if (s === 'matched') return 'border-green-500';
  if (s === 'possible') return 'border-amber-500';
  return 'border-red-500';
}

function matchHintForAnalyzeStep(step) {
  const m = analyzeResult.value?.matches?.find((x) => x.step_nr === step.step_nr);
  if (m?.status === 'matched' && m.matched_xstep) {
    return `✅ ${t('digitalize.matchedAs', { id: m.matched_xstep })}`;
  }
  if (m?.status === 'possible' && m.matched_xstep) {
    return `🟡 ${t('digitalize.possibleAs', { id: m.matched_xstep })}`;
  }
  return `🆕 ${t('digitalize.newInRepo')}`;
}

function validateFile(file) {
  if (!file) return false;
  if (file.size > MAX_BYTES) {
    toast.error(t('digitalize.fileTooLarge'));
    return false;
  }
  if (!ACCEPTED_EXT.test(file.name)) {
    toast.error(t('digitalize.fileTypeInvalid'));
    return false;
  }
  return true;
}

function setFile(file) {
  if (!validateFile(file)) return;
  clearFile();
  selectedFile.value = file;
  if (file.type.startsWith('image/')) {
    localPreviewUrl.value = URL.createObjectURL(file);
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (file) setFile(file);
}

function onDrop(e) {
  dragOver.value = false;
  const file = e.dataTransfer.files?.[0];
  if (file) setFile(file);
}

function clearFile() {
  if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
  selectedFile.value = null;
  localPreviewUrl.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function runLoading(phases, fn) {
  loading.value = true;
  loadingProgress.value = 0;
  try {
    for (let i = 0; i < phases.length; i++) {
      loadingMessage.value = phases[i].message;
      loadingPhase.value = phases[i].phase;
      loadingProgress.value = ((i + 1) / phases.length) * 100;
      if (phases[i].delay) await new Promise((r) => setTimeout(r, phases[i].delay));
    }
    return await fn();
  } finally {
    loading.value = false;
    loadingProgress.value = 0;
  }
}

async function runAnalyze() {
  if (!selectedFile.value) return;

  const form = new FormData();
  form.append('file', selectedFile.value);

  try {
    const result = await runLoading(
      [
        { message: t('digitalize.loadingAnalyze'), phase: t('digitalize.phasePrep'), delay: 400 },
        { message: t('digitalize.loadingAnalyze'), phase: t('digitalize.phaseVision'), delay: 300 },
        { message: t('digitalize.loadingAnalyze'), phase: t('digitalize.phaseQuality'), delay: 200 },
      ],
      async () => {
        const res = await api.post('/vision/analyze', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
    );

    analyzeResult.value = result;
    wizardStep.value = 2;
    toast.success(t('digitalize.analyzeDone'));
  } catch (err) {
    toast.error(err.response?.data?.error || t('digitalize.analyzeFailed'));
  }
}

async function runGenerate() {
  if (!selectedFile.value) return;

  const form = new FormData();
  form.append('file', selectedFile.value);
  form.append('locale', locale.value === 'en' ? 'en' : 'de');

  try {
    const result = await runLoading(
      [
        { message: t('digitalize.loadingGenerate'), phase: t('digitalize.phaseMatch'), delay: 400 },
        { message: t('digitalize.loadingGenerate'), phase: t('digitalize.phaseBuild'), delay: 300 },
        { message: t('digitalize.loadingGenerate'), phase: t('digitalize.phaseFinalize'), delay: 200 },
      ],
      async () => {
        const res = await api.post('/vision/generate', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
    );

    generateResult.value = result;
    piSheet.value = JSON.parse(JSON.stringify(result.pi_sheet));
    savedSheetId.value = result.pi_sheet?.id || null;
    matchesByStep.value = Object.fromEntries(
      (result.matches || []).map((m) => [m.step_nr, m])
    );
    enrichStepsWithMatches();
    wizardStep.value = 3;
    toast.success(t('digitalize.generateDone'));
  } catch (err) {
    toast.error(err.response?.data?.error || t('digitalize.generateFailed'));
  }
}

function enrichStepsWithMatches() {
  if (!piSheet.value?.steps) return;
  piSheet.value.steps = piSheet.value.steps.map((step) => {
    const m = matchesByStep.value[step.step_nr];
    return {
      ...step,
      match_status: step.match_status || m?.status || 'new',
      match_confidence: step.match_confidence ?? m?.match_confidence ?? 0,
    };
  });
}

function updateMatchStatus(step) {
  const conf = step.match_confidence ?? 0;
  if (step.xstep_id && conf >= 0.85) step.match_status = 'matched';
  else if (step.xstep_id || conf >= 0.6) step.match_status = 'possible';
  else step.match_status = 'new';
}

async function searchXsteps(stepNr) {
  const q = xstepSearch[stepNr]?.trim();
  if (!q || q.length < 2) {
    xstepOptions[stepNr] = [];
    return;
  }
  try {
    const data = await get('/xsteps', { params: { search: q, limit: 8 } });
    xstepOptions[stepNr] = data.items || [];
  } catch {
    xstepOptions[stepNr] = [];
  }
}

function assignXstep(stepNr, xstepId) {
  if (!xstepId || !piSheet.value) return;
  const xs = xstepOptions[stepNr]?.find((x) => x.xstep_id === xstepId);
  const step = piSheet.value.steps.find((s) => s.step_nr === stepNr);
  if (!step) return;
  step.xstep_id = xstepId;
  if (xs) {
    step.name = xs.name;
    step.category = xs.category;
    step.instruction = xs.instruction_template || step.instruction;
    step.params = xs.params || step.params;
    step.match_confidence = 0.95;
    step.match_status = 'matched';
    step.is_suggestion = false;
  }
  updateMatchStatus(step);
}

function startEditStep(step) {
  editingStepNr.value = step.step_nr;
  editDraft.name = step.name;
  editDraft.instruction = step.instruction || '';
}

function saveEditStep() {
  const step = piSheet.value?.steps.find((s) => s.step_nr === editingStepNr.value);
  if (step) {
    step.name = editDraft.name;
    step.instruction = editDraft.instruction;
  }
  editingStepNr.value = null;
}

function removeStep(stepNr) {
  if (!piSheet.value) return;
  piSheet.value.steps = piSheet.value.steps
    .filter((s) => s.step_nr !== stepNr)
    .map((s, i) => ({ ...s, step_nr: i + 1 }));
}

function applyRepositoryParams() {
  if (!piSheet.value?.steps) return;
  for (const step of piSheet.value.steps) {
    const m = matchesByStep.value[step.step_nr];
    const repo = m?.matched_xstep_record;
    if (repo?.params?.length) {
      step.params = JSON.parse(JSON.stringify(repo.params));
      if (m.matched_xstep) {
        step.xstep_id = m.matched_xstep;
        step.name = repo.name || step.name;
        step.category = repo.category || step.category;
        step.instruction = repo.instruction_template || step.instruction;
        step.match_status = m.status === 'matched' ? 'matched' : 'possible';
        step.match_confidence = m.match_confidence ?? step.match_confidence;
      }
    }
  }
  toast.success(t('digitalize.repoParamsApplied'));
}

function supplementGmpSteps() {
  if (!piSheet.value) return;
  const names = piSheet.value.steps.map((s) => s.name.toLowerCase());
  const additions = [];
  if (!names.some((n) => n.includes('linien') || n.includes('clearance'))) {
    additions.push({
      step_nr: 0,
      name: 'Linienclearance (GMP-Vorschlag)',
      category: 'Prozess',
      instruction: 'Linienclearance vor Produktionsbeginn — KI-Vorschlag.',
      params: [],
      is_suggestion: true,
      match_status: 'new',
      match_confidence: 0,
    });
  }
  if (!names.some((n) => n.includes('ipc') || n.includes('gewicht'))) {
    additions.push({
      step_nr: 0,
      name: 'IPC Gewichtskontrolle (GMP-Vorschlag)',
      category: 'Qualität',
      instruction: 'Stichprobenartige Gewichtskontrolle — KI-Vorschlag.',
      params: [{ name: 'Stichprobe', type: 'input', required: true }],
      is_suggestion: true,
      match_status: 'new',
      gmp_relevant: true,
    });
  }
  if (!additions.length) {
    toast.warning(t('digitalize.gmpAlready'));
    return;
  }
  const maxNr = Math.max(0, ...piSheet.value.steps.map((s) => s.step_nr));
  additions.forEach((a, i) => {
    a.step_nr = maxNr + i + 1;
    piSheet.value.steps.push(a);
  });
  toast.success(t('digitalize.gmpAdded'));
}

async function saveTemplate() {
  const id = savedSheetId.value || piSheet.value?.id;
  if (!id) {
    toast.error(t('digitalize.saveFirst'));
    return;
  }
  saving.value = true;
  try {
    const edits = (piSheet.value?.steps || []).map((step) => ({
      step_nr: step.step_nr,
      name: step.name,
      category: step.category,
      instruction: step.instruction,
      params: step.params || [],
      xstep_id: step.xstep_id,
    }));
    const confirmed_steps = (piSheet.value?.steps || [])
      .filter((s) => s.match_status === 'possible' && s.xstep_id)
      .map((s) => ({
        step_nr: s.step_nr,
        xstep_id: s.xstep_id,
        accept_repository_match: true,
      }));

    const res = await post('/vision/confirm', {
      pi_sheet_id: id,
      edits,
      confirmed_steps,
    });
    piSheet.value = res.pi_sheet;
    savedSheetId.value = res.pi_sheet?.id;
    if (addNewXsteps.value) {
      toast.warning(t('digitalize.addNewRepoHint'));
    }
    toast.success(t('digitalize.saveDone'));
  } catch (err) {
    toast.error(err.response?.data?.error || t('digitalize.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function downloadPdf() {
  const id = savedSheetId.value || piSheet.value?.id;
  if (!id) {
    toast.error(t('digitalize.saveFirst'));
    return;
  }
  try {
    const res = await api.get(`/templates/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pi-sheet-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error(t('admin.pdfFailed'));
  }
}

function resetWizard() {
  wizardStep.value = 1;
  analyzeResult.value = null;
  generateResult.value = null;
  piSheet.value = null;
  savedSheetId.value = null;
  clearFile();
}
</script>
