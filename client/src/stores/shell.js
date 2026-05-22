import { defineStore } from 'pinia';
import { ref } from 'vue';

/** Shared SAP shell UI state (chat side panels). */
export const useShellStore = defineStore('shell', () => {
  const chatHistoryOpen = ref(false);
  const chatPreviewOpen = ref(false);
  const adminNavOpen = ref(false);

  function toggleChatHistory() {
    chatHistoryOpen.value = !chatHistoryOpen.value;
  }

  function toggleChatPreview() {
    chatPreviewOpen.value = !chatPreviewOpen.value;
  }

  function closeChatPanels() {
    chatHistoryOpen.value = false;
    chatPreviewOpen.value = false;
  }

  function closeAdminNav() {
    adminNavOpen.value = false;
  }

  return {
    chatHistoryOpen,
    chatPreviewOpen,
    adminNavOpen,
    toggleChatHistory,
    toggleChatPreview,
    closeChatPanels,
    closeAdminNav,
  };
});
