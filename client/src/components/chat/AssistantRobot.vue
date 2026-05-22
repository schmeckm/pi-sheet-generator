<template>
  <div
    class="assistant-robot inline-flex shrink-0 items-center justify-center"
    :class="[
      `assistant-robot--${size}`,
      sizeClasses,
      { 'assistant-robot--animated': animated },
      orb
        ? 'sap-joule-orb rounded-full'
        : hero
          ? 'text-white'
          : 'rounded-lg bg-[var(--sapJouleHighlight)] text-[var(--sapJoulePrimary)]',
    ]"
  >
    <svg
      class="assistant-robot__svg block h-full w-full"
      viewBox="4 0 56 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="ariaLabel"
    >
      <!-- Antenna -->
      <line x1="32" y1="6" x2="32" y2="2" />
      <circle cx="32" cy="1.5" r="1.5" fill="currentColor" stroke="none" />

      <!-- Head -->
      <rect x="22" y="6" width="20" height="14" rx="4" />
      <circle cx="28" cy="13" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="36" cy="13" r="1.75" fill="currentColor" stroke="none" />
      <path d="M27 16.5 Q32 18.5 37 16.5" />

      <!-- Body -->
      <rect x="18" y="22" width="28" height="26" rx="4" />
      <rect x="21" y="26" width="22" height="16" rx="2" class="assistant-robot__chest" />

      <text
          x="32"
          y="33.8"
          text-anchor="middle"
          class="assistant-robot__make"
          fill="currentColor"
          stroke="none"
        >
          MAKE
        </text>
        <text
          x="32"
          y="39"
          text-anchor="middle"
          class="assistant-robot__tagline"
          fill="currentColor"
          stroke="none"
        >
          make it happen
        </text>

      <!-- Arms -->
      <path d="M18 28 L10 34 L10 38" />
      <path d="M46 28 L54 34 L54 38" />

      <!-- Legs -->
      <path d="M24 48 L22 56" />
      <path d="M40 48 L42 56" />
      <line x1="19" y1="56" x2="25" y2="56" />
      <line x1="37" y1="56" x2="43" y2="56" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl', 'hero'].includes(v),
  },
  orb: { type: Boolean, default: false },
  hero: { type: Boolean, default: false },
  animated: { type: Boolean, default: false },
});

const { t } = useI18n();

const sizeClasses = computed(() => {
  if (props.orb) {
    return {
      sm: 'h-9 w-9 p-1 text-white',
      md: 'h-14 w-14 p-1.5 text-white',
      lg: 'h-16 w-16 p-2 text-white',
    }[props.size];
  }
  return {
    sm: 'h-9 w-9 p-0.5',
    md: 'h-14 w-14 p-1',
    lg: 'h-20 w-[4.5rem] p-1',
    xl: 'h-32 w-32 p-1',
    hero: 'h-44 w-44 p-1.5 sm:h-48 sm:w-48',
  }[props.size];
});

const ariaLabel = computed(() => t('chat.assistantName'));
</script>

<style scoped>
.assistant-robot__svg {
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.assistant-robot__chest {
  stroke-width: 1.25;
  opacity: 0.35;
}

.assistant-robot--sm .assistant-robot__make {
  font-size: 3.8px;
}

.assistant-robot--sm .assistant-robot__tagline {
  font-size: 1.8px;
}

.assistant-robot--xl .assistant-robot__make {
  font-size: 5px;
}

.assistant-robot--xl .assistant-robot__tagline {
  font-size: 2.2px;
}

.assistant-robot--hero .assistant-robot__svg {
  stroke-width: 2;
}

.assistant-robot--hero .assistant-robot__make {
  font-size: 4.5px;
}

.assistant-robot--hero .assistant-robot__tagline {
  font-size: 3px;
}

.assistant-robot__make {
  font-size: 4px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.assistant-robot__tagline {
  font-size: 3px;
  font-weight: 500;
  letter-spacing: 0;
}

.assistant-robot--animated .assistant-robot__svg {
  animation: assistant-robot-bob 1.4s ease-in-out infinite;
}

.assistant-robot--animated .assistant-robot__svg circle:nth-of-type(2),
.assistant-robot--animated .assistant-robot__svg circle:nth-of-type(3) {
  animation: assistant-robot-blink 3s step-end infinite;
}

@keyframes assistant-robot-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1px);
  }
}

@keyframes assistant-robot-blink {
  0%,
  92%,
  100% {
    transform: scaleY(1);
    transform-origin: center;
  }
  94% {
    transform: scaleY(0.15);
    transform-origin: center;
  }
}
</style>
