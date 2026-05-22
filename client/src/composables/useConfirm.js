import { ref } from 'vue';

const state = ref({
  open: false,
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: '',
  variant: 'danger',
  resolve: null,
});

export function useConfirm() {
  function confirm(options = {}) {
    return new Promise((resolve) => {
      state.value = {
        open: true,
        title: options.title || '',
        message: options.message || '',
        confirmLabel: options.confirmLabel || '',
        cancelLabel: options.cancelLabel || '',
        variant: options.variant || 'danger',
        resolve,
      };
    });
  }

  function accept() {
    const { resolve } = state.value;
    state.value.open = false;
    resolve?.(true);
  }

  function cancel() {
    const { resolve } = state.value;
    state.value.open = false;
    resolve?.(false);
  }

  return { state, confirm, accept, cancel };
}
