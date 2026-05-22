<template>
  <div class="mermaid-zoom">
    <div
      v-if="!disabled"
      class="flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 border-[var(--sapNeutralBorderColor)] bg-slate-50 px-3 py-2"
      role="toolbar"
      :aria-label="t('graph.zoomToolbar')"
    >
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-sm"
        :disabled="scale <= minScale"
        :title="t('graph.zoomOut')"
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
        :title="t('graph.zoomIn')"
        @click="zoomIn"
      >
        +
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--transparent !min-h-8 !px-2 text-xs"
        :title="t('graph.zoomReset')"
        @click="resetZoom"
      >
        {{ t('graph.zoomReset') }}
      </button>
    </div>

    <div
      ref="viewportRef"
      class="mermaid-zoom-viewport max-h-[min(75vh,720px)] min-h-[280px] overflow-auto rounded-b-lg border border-[var(--sapNeutralBorderColor)] bg-white"
      :class="[
        disabled ? 'rounded-t-lg' : '',
        panActive ? 'is-panning' : 'cursor-grab',
      ]"
      :title="disabled ? undefined : t('graph.panHint')"
      @wheel="onWheel"
      @pointerdown="(e) => onPanPointerDown(e, viewportRef)"
      @pointermove="(e) => onPanPointerMove(e, viewportRef)"
      @pointerup="(e) => onPanPointerUp(e, viewportRef)"
      @pointercancel="(e) => onPanPointerUp(e, viewportRef)"
    >
      <div
        class="mermaid-zoom-inner inline-block min-w-full origin-top-left p-4 transition-transform duration-150"
        :style="innerStyle"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  initialScale: { type: Number, default: 1 },
});

const { t } = useI18n();

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const minScale = ZOOM_STEPS[0];
const maxScale = ZOOM_STEPS[ZOOM_STEPS.length - 1];

const scale = ref(props.initialScale);
const viewportRef = ref(null);
const panActive = ref(false);
let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

const innerStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  width: scale.value > 1 ? `${100 / scale.value}%` : undefined,
}));

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
  if (props.disabled) return;
  e.preventDefault();
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}

function onPanPointerDown(e, viewportEl) {
  const el = viewportEl?.value;
  if (props.disabled || !el || e.button !== 0) return;
  panActive.value = true;
  panStart = {
    x: e.clientX,
    y: e.clientY,
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop,
  };
  el.setPointerCapture(e.pointerId);
}

function onPanPointerMove(e, viewportEl) {
  const el = viewportEl?.value;
  if (!panActive.value || !el) return;
  const dx = e.clientX - panStart.x;
  const dy = e.clientY - panStart.y;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) e.preventDefault();
  el.scrollLeft = panStart.scrollLeft - dx;
  el.scrollTop = panStart.scrollTop - dy;
}

function onPanPointerUp(e, viewportEl) {
  const el = viewportEl?.value;
  if (!panActive.value || !el) return;
  panActive.value = false;
  if (el.hasPointerCapture?.(e.pointerId)) {
    el.releasePointerCapture(e.pointerId);
  }
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) scale.value = props.initialScale;
  }
);
</script>

<style scoped>
.mermaid-zoom-inner :deep(svg) {
  height: auto;
  display: block;
  max-width: none;
  background: #ffffff;
}

.mermaid-zoom-inner :deep(.node rect),
.mermaid-zoom-inner :deep(.node polygon) {
  stroke-width: 2px;
}

.mermaid-zoom-inner :deep(.nodeLabel),
.mermaid-zoom-inner :deep(.label),
.mermaid-zoom-inner :deep(.nodeLabel span) {
  color: #0f172a !important;
  fill: #0f172a !important;
}

.mermaid-zoom-viewport.is-panning {
  cursor: grabbing;
  user-select: none;
}

.mermaid-zoom-viewport.is-panning :deep(*) {
  cursor: grabbing;
}
</style>
