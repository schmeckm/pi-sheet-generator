<template>
  <div class="sap-joule-panel flex h-full min-h-0 flex-col">
    <div class="relative flex min-h-0 flex-1">
      <div
        v-if="shell.chatHistoryOpen"
        class="absolute inset-0 z-20 bg-black/20 lg:hidden"
        @click="shell.chatHistoryOpen = false"
      />
      <ChatHistorySidebar
        v-show="shell.chatHistoryOpen"
        :items="chat.history"
        :active-id="chat.activeHistoryId"
        :mobile="isMobile"
        class="lg:relative"
        @select="onHistorySelect"
        @close="shell.chatHistoryOpen = false"
        @new-chat="onNewChat"
      />

      <section class="flex min-w-0 flex-1 flex-col">
        <div ref="scrollEl" class="flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-3xl px-4 pt-4">
            <ChatWelcome v-if="showWelcome" :user-name="auth.user?.name?.split(' ')[0]" />

            <template v-for="(m, i) in chat.messages" :key="i">
              <ChatMessage
                v-if="!(chat.isGenerating && i === chat.messages.length - 1 && m.streaming)"
                :message="m"
                @open-preview="openPreview"
              />
            </template>

            <ChatThinking
              v-if="chat.isGenerating"
              :phase="chat.thinkingPhase"
              :mode="chat.requestMode"
              :active-tools="chat.activeTools"
            />
          </div>

          <QuickPrompts v-if="showQuickPrompts" class="mt-2" @select="onQuickPrompt" />
        </div>

        <ChatInput ref="chatInputRef" :disabled="chat.isGenerating" @send="onSend" />
      </section>

      <aside
        class="flex w-full min-w-[280px] flex-col border-l border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] transition-transform lg:w-[min(42%,480px)] lg:max-w-[480px] lg:shrink-0"
        :class="
          shell.chatPreviewOpen
            ? 'fixed inset-y-[var(--sapShell_Height)] right-0 z-30 max-w-md shadow-lg lg:relative lg:inset-auto lg:z-0 lg:flex lg:max-w-[480px]'
            : 'hidden lg:flex'
        "
      >
        <div
          class="sap-object-header flex items-center justify-between !py-2 lg:!hidden"
        >
          <div>
            <h2 class="text-sm font-semibold">{{ t('joule.previewTitle') }}</h2>
            <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('joule.previewSubtitle') }}</p>
          </div>
          <button type="button" class="sap-btn sap-btn--ghost !p-2" @click="shell.chatPreviewOpen = false">
            ✕
          </button>
        </div>
        <div class="hidden sap-object-header lg:block">
          <h2 class="text-sm font-semibold">{{ t('joule.previewTitle') }}</h2>
          <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('joule.previewSubtitle') }}</p>
        </div>
        <div class="relative min-h-0 flex-1">
          <div
            v-if="chat.isGenerating && chat.requestMode === 'pi_sheet' && !chat.currentPiSheet"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8"
          >
            <div class="sap-joule-orb h-12 w-12 animate-pulse rounded-full opacity-80" />
            <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('joule.building') }}</p>
          </div>
          <PISheetPreview
            v-if="!(chat.isGenerating && chat.requestMode === 'pi_sheet' && !chat.currentPiSheet)"
            :sheet="chat.currentPiSheet"
            class="h-full"
            @sheet-updated="onSheetUpdated"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useShellStore } from '@/stores/shell';
import { useToast } from '@/composables/useToast';
import { useNewChat } from '@/composables/useNewChat';
import ChatWelcome from '@/components/chat/ChatWelcome.vue';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import ChatInput from '@/components/chat/ChatInput.vue';
import ChatThinking from '@/components/chat/ChatThinking.vue';
import QuickPrompts from '@/components/chat/QuickPrompts.vue';
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar.vue';
import PISheetPreview from '@/components/pisheet/PISheetPreview.vue';

const { t } = useI18n();
const auth = useAuthStore();
const chat = useChatStore();
const shell = useShellStore();
const toast = useToast();
const { startNewChat } = useNewChat();
const scrollEl = ref(null);
const chatInputRef = ref(null);
const isMobile = ref(false);

const showWelcome = computed(() => chat.messages.length === 0 && !chat.isGenerating);
const showQuickPrompts = computed(() => chat.messages.length === 0 && !chat.isGenerating);

function checkMobile() {
  isMobile.value = window.innerWidth < 1024;
}

onMounted(() => {
  chat.loadHistory();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  shell.closeChatPanels();
});

async function scrollToBottom() {
  await nextTick();
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' });
}

async function onSend(prompt) {
  try {
    await chat.sendMessage(prompt);
    await scrollToBottom();
    if (isMobile.value && chat.requestMode === 'pi_sheet') shell.chatPreviewOpen = true;
  } catch (e) {
    const msg = e.message || e.response?.data?.error || t('chat.generateFailedToast');
    toast.error(msg);
    chat.messages.push({ role: 'assistant', content: msg, timestamp: Date.now() });
    await scrollToBottom();
  }
}

async function onQuickPrompt(prompt) {
  if (chat.isGenerating || !prompt?.trim()) return;
  await onSend(prompt.trim());
}

function openPreview(piSheet) {
  if (piSheet) {
    chat.showPiSheetPreview(piSheet);
    return;
  }
  const last = [...chat.messages].reverse().find((m) => m.piSheet);
  if (last?.piSheet) chat.showPiSheetPreview(last.piSheet);
  else shell.chatPreviewOpen = true;
}

async function onHistorySelect(id) {
  try {
    await chat.loadPiSheet(id);
    shell.chatHistoryOpen = false;
    if (isMobile.value) shell.chatPreviewOpen = true;
  } catch {
    toast.error(t('chat.loadSheetFailed'));
  }
}

function onNewChat() {
  startNewChat();
}

function onSheetUpdated(sheet) {
  chat.applyPiSheetToPreview(sheet);
}
</script>
