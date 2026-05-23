<template>
  <div
    class="assistant-robot inline-flex shrink-0 items-center justify-center"
    :class="[
      `assistant-robot--${size}`,
      sizeClasses,
      {
        'assistant-robot--animated': animated,
        'assistant-robot--active': active,
      },
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
      <g class="assistant-robot__figure">
        <g class="assistant-robot__antenna">
          <line x1="32" y1="6" x2="32" y2="2" />
          <circle cx="32" cy="1.5" r="1.5" fill="currentColor" stroke="none" />
        </g>

        <g class="assistant-robot__head">
          <rect x="22" y="6" width="20" height="14" rx="4" />
          <circle class="assistant-robot__eye" cx="28" cy="13" r="1.75" fill="currentColor" stroke="none" />
          <circle class="assistant-robot__eye" cx="36" cy="13" r="1.75" fill="currentColor" stroke="none" />
          <path d="M27 16.5 Q32 18.5 37 16.5" />
        </g>

        <g class="assistant-robot__torso">
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
        </g>

        <g class="assistant-robot__arm assistant-robot__arm--left">
          <path d="M18 28 L10 34 L10 38" />
        </g>
        <g class="assistant-robot__arm assistant-robot__arm--right">
          <path d="M46 28 L54 34 L54 38" />
        </g>

        <g class="assistant-robot__legs">
          <path d="M24 48 L22 56" />
          <path d="M40 48 L42 56" />
          <line x1="19" y1="56" x2="25" y2="56" />
          <line x1="37" y1="56" x2="43" y2="56" />
        </g>
      </g>
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
  /** Idle motion: bob, blink, gentle sway */
  animated: { type: Boolean, default: false },
  /** Busy motion: arm wave, antenna wiggle, stronger bob (e.g. while thinking) */
  active: { type: Boolean, default: false },
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

/* SVG transforms need an explicit box — otherwise animations often do nothing */
.assistant-robot--animated .assistant-robot__figure,
.assistant-robot--animated .assistant-robot__eye,
.assistant-robot--animated .assistant-robot__antenna,
.assistant-robot--active .assistant-robot__figure,
.assistant-robot--active .assistant-robot__arm--left,
.assistant-robot--active .assistant-robot__arm--right,
.assistant-robot--active .assistant-robot__antenna,
.assistant-robot--active .assistant-robot__legs,
.assistant-robot--active .assistant-robot__head {
  transform-box: fill-box;
}

/* —— Idle animation —— */
.assistant-robot--animated {
  animation: assistant-robot-shell-bob 2.2s ease-in-out infinite;
}

.assistant-robot--animated .assistant-robot__figure {
  animation: assistant-robot-bob 2.2s ease-in-out infinite;
  transform-origin: center center;
}

.assistant-robot--animated .assistant-robot__eye {
  animation: assistant-robot-blink 3.5s step-end infinite;
  transform-origin: center center;
}

.assistant-robot--animated .assistant-robot__antenna {
  animation: assistant-robot-antenna-idle 2.4s ease-in-out infinite;
  transform-origin: center top;
}

/* —— Active / thinking animation —— */
.assistant-robot--active {
  animation: assistant-robot-shell-bob-active 0.85s ease-in-out infinite;
}

.assistant-robot--active .assistant-robot__figure {
  animation: assistant-robot-bob-active 0.85s ease-in-out infinite;
  transform-origin: center center;
}

.assistant-robot--active .assistant-robot__arm--left {
  animation: assistant-robot-arm-left 1s ease-in-out infinite;
  transform-origin: right top;
}

.assistant-robot--active .assistant-robot__arm--right {
  animation: assistant-robot-arm-right 1s ease-in-out infinite;
  animation-delay: 0.5s;
  transform-origin: left top;
}

.assistant-robot--active .assistant-robot__antenna {
  animation: assistant-robot-antenna-active 0.45s ease-in-out infinite alternate;
  transform-origin: center top;
}

.assistant-robot--active .assistant-robot__legs {
  animation: assistant-robot-legs 0.85s ease-in-out infinite;
  transform-origin: center top;
}

.assistant-robot--active .assistant-robot__head {
  animation: assistant-robot-head-nod 1.7s ease-in-out infinite;
  transform-origin: center bottom;
}

@keyframes assistant-robot-shell-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes assistant-robot-shell-bob-active {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes assistant-robot-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-1px) rotate(-2deg);
  }
}

@keyframes assistant-robot-bob-active {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-2px) rotate(-3deg);
  }
  75% {
    transform: translateY(-1px) rotate(3deg);
  }
}

@keyframes assistant-robot-blink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }
  93% {
    transform: scaleY(0.12);
  }
}

@keyframes assistant-robot-antenna-idle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(8deg);
  }
}

@keyframes assistant-robot-antenna-active {
  from {
    transform: rotate(-8deg);
  }
  to {
    transform: rotate(8deg);
  }
}

@keyframes assistant-robot-arm-left {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-22deg);
  }
}

@keyframes assistant-robot-arm-right {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(22deg);
  }
}

@keyframes assistant-robot-legs {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(1px);
  }
}

@keyframes assistant-robot-head-nod {
  0%,
  100% {
    transform: rotate(0deg);
  }
  40% {
    transform: rotate(3deg);
  }
  60% {
    transform: rotate(-2deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-robot--animated,
  .assistant-robot--active,
  .assistant-robot--animated .assistant-robot__figure,
  .assistant-robot--animated .assistant-robot__eye,
  .assistant-robot--animated .assistant-robot__antenna,
  .assistant-robot--active .assistant-robot__figure,
  .assistant-robot--active .assistant-robot__arm--left,
  .assistant-robot--active .assistant-robot__arm--right,
  .assistant-robot--active .assistant-robot__antenna,
  .assistant-robot--active .assistant-robot__legs,
  .assistant-robot--active .assistant-robot__head {
    animation: none;
  }
}
</style>
