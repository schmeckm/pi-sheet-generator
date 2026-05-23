<template>
  <div v-if="!zoomable && type === 'image'" class="my-4">
    <div
      class="overflow-hidden rounded-lg border border-[var(--sapNeutralBorderColor)] bg-white p-4"
    >
      <img
        v-if="src && !imageMissing"
        :src="src"
        :alt="alt"
        class="mx-auto block w-full max-w-full"
        draggable="false"
        @error="imageMissing = true"
      />
      <p
        v-if="imageMissing"
        class="text-sm text-[var(--sapContentLabelColor)]"
      >
        {{ t('help.imageMissing', { path: src }) }}
      </p>
    </div>
    <p v-if="caption" class="mt-2 text-xs text-[var(--sapContentLabelColor)]">{{ caption }}</p>
  </div>

  <div v-else class="my-4">
    <div
      class="flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 border-[var(--sapNeutralBorderColor)] bg-slate-50 px-3 py-2"
      role="toolbar"
      :aria-label="t('help.zoomToolbar')"
    >
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-sm"
        :disabled="scale <= minScale"
        :title="t('help.zoomOut')"
        @click="zoomOut"
      >
        −
      </button>
      <span class="min-w-[3.5rem] text-center text-xs font-medium text-[var(--sapContentLabelColor)]">
        {{ Math.round(scale * 100) }}%
      </span>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-sm"
        :disabled="scale >= maxScale"
        :title="t('help.zoomIn')"
        @click="zoomIn"
      >
        +
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-xs"
        :title="t('help.zoomReset')"
        @click="resetZoom"
      >
        {{ t('help.zoomReset') }}
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-xs"
        :title="t('help.zoomFullscreen')"
        @click="openFullscreen"
      >
        {{ t('help.zoomFullscreen') }}
      </button>
    </div>

    <div
      ref="viewportRef"
      class="max-h-[min(70vh,640px)] overflow-auto rounded-b-lg border border-[var(--sapNeutralBorderColor)] bg-white"
      @wheel.prevent="onWheel"
    >
      <div
        class="origin-top-left p-4 transition-transform duration-150"
        :style="{ transform: `scale(${scale})`, width: scale > 1 ? `${100 / scale}%` : '100%' }"
      >
        <img
          v-if="type === 'image' && src"
          :src="src"
          :alt="alt"
          class="mx-auto max-w-full cursor-zoom-in"
          draggable="false"
          @click="openFullscreen"
          @error="imageMissing = true"
        />
        <p
          v-if="type === 'image' && imageMissing"
          class="text-sm text-[var(--sapContentLabelColor)]"
        >
          {{ t('help.imageMissing', { path: src }) }}
        </p>
        <pre
          v-else-if="type === 'diagram'"
          class="inline-block min-w-full font-mono text-sm leading-snug text-slate-800"
        >{{ content }}</pre>
      </div>
    </div>

    <p v-if="caption" class="mt-2 text-xs text-[var(--sapContentLabelColor)]">{{ caption }}</p>

    <Teleport to="body">
      <div
        v-if="fullscreen"
        class="fixed inset-0 z-[100] flex flex-col bg-black/85"
        role="dialog"
        aria-modal="true"
        :aria-label="t('help.zoomFullscreen')"
        @click.self="closeFullscreen"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-white/20 px-4 py-3 text-white"
        >
          <div class="flex items-center gap-2">
            <button type="button" class="rounded px-3 py-1 text-lg hover:bg-white/10" @click="zoomOut">−</button>
            <span class="text-sm">{{ Math.round(scale * 100) }}%</span>
            <button type="button" class="rounded px-3 py-1 text-lg hover:bg-white/10" @click="zoomIn">+</button>
            <button type="button" class="rounded px-2 py-1 text-sm hover:bg-white/10" @click="resetZoom">
              {{ t('help.zoomReset') }}
            </button>
          </div>
          <button
            type="button"
            class="rounded px-3 py-1 text-sm hover:bg-white/10"
            @click="closeFullscreen"
          >
            {{ t('help.zoomClose') }} ✕
          </button>
        </div>
        <div
          ref="fullscreenRef"
          class="flex flex-1 items-start justify-center overflow-auto p-6"
          @wheel.prevent="onWheel"
        >
          <div
            class="origin-center transition-transform duration-150"
            :style="{ transform: `scale(${scale})` }"
          >
            <img
              v-if="type === 'image' && src && !imageMissing"
              :src="src"
              :alt="alt"
              class="max-h-[85vh] max-w-[min(95vw,1400px)] object-contain"
              draggable="false"
            />
            <pre
              v-else-if="type === 'diagram'"
              class="rounded bg-slate-900 p-6 font-mono text-sm leading-snug text-slate-100 shadow-xl"
            >{{ content }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (v) => v === 'image' || v === 'diagram',
  },
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  content: { type: String, default: '' },
  caption: { type: String, default: '' },
  initialScale: { type: Number, default: 1.25 },
  zoomable: { type: Boolean, default: true },
});

const { t } = useI18n();

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const minScale = ZOOM_STEPS[0];
const maxScale = ZOOM_STEPS[ZOOM_STEPS.length - 1];

const scale = ref(props.initialScale);
const fullscreen = ref(false);
const imageMissing = ref(false);
function zoomIn() {
  const i = ZOOM_STEPS.findIndex((s) => s > scale.value + 0.001);
  if (i >= 0) scale.value = ZOOM_STEPS[i];
}

function zoomOut() {
  let i = -1;
  for (let j = ZOOM_STEPS.length - 1; j >= 0; j -= 1) {
    if (ZOOM_STEPS[j] < scale.value - 0.001) {
      i = j;
      break;
    }
  }
  if (i >= 0) scale.value = ZOOM_STEPS[i];
}

function resetZoom() {
  scale.value = props.initialScale;
}

function onWheel(e) {
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}

function openFullscreen() {
  fullscreen.value = true;
}

function closeFullscreen() {
  fullscreen.value = false;
}

function onKeydown(e) {
  if (!fullscreen.value) return;
  if (e.key === 'Escape') closeFullscreen();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>
