import { ref, onMounted, onUnmounted } from 'vue';

export const MD_DOWN = '(max-width: 767px)';
export const LG_DOWN = '(max-width: 1023px)';

/** Reactive matchMedia helper for responsive layouts. */
export function useBreakpoint(query = LG_DOWN) {
  const matches = ref(false);
  let mq = null;

  function update() {
    matches.value = mq?.matches ?? false;
  }

  onMounted(() => {
    mq = window.matchMedia(query);
    update();
    mq.addEventListener('change', update);
  });

  onUnmounted(() => {
    mq?.removeEventListener('change', update);
  });

  return { matches, isMobile: matches };
}
