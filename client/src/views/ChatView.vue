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

      <section class="sap-joule-copilot">
        <div ref="scrollEl" class="sap-joule-copilot__body">
          <ChatWelcome
            v-if="showWelcome"
            :user-name="auth.user?.name?.split(' ')[0]"
            @quick-prompt="onQuickPrompt"
          />

          <div v-if="!showWelcome" class="sap-joule-thread">
            <template v-for="(m, i) in chat.messages" :key="i">
              <ChatMessage
                v-if="
                  !(
                    chat.isGenerating &&
                    i === chat.messages.length - 1 &&
                    m.streaming &&
                    !m.content
                  )
                "
                :message="m"
                @open-preview="openPreview"
              />
            </template>

            <ChatThinking
              v-if="chat.isGenerating && !lastAssistantHasContent"
              :phase="chat.thinkingPhase"
              :mode="chat.requestMode"
              :active-tools="chat.activeTools"
              :started-at="chat.thinkingStartedAt"
              :step-started-at="chat.stepStartedAt"
              :search-stats="chat.searchStats"
            />
          </div>
        </div>

        <ChatInput
          ref="chatInputRef"
          :disabled="chat.isGenerating"
          :can-stop="chat.isGenerating"
          :token-budget-line="tokenBudgetLine"
          @send="onSend"
          @stop="chat.stopGeneration()"
        />
      </section>

      <aside
        class="sap-joule-preview-panel flex w-full min-h-0 min-w-[280px] flex-col overflow-hidden border-l border-[var(--sapNeutralBorderColor)] bg-[var(--sapGroupContentBackground)] transition-transform lg:w-[min(42%,480px)] lg:max-w-[480px] lg:shrink-0"
        :class="
          shell.chatPreviewOpen
            ? 'fixed top-[var(--sapShell_Height)] bottom-[var(--sapFooter_Height)] right-0 z-30 max-w-md shadow-lg lg:relative lg:inset-auto lg:top-auto lg:bottom-auto lg:z-0 lg:flex lg:max-w-[480px]'
            : 'hidden lg:flex'
        "
      >
        <div
          class="sap-object-header flex shrink-0 items-center justify-between !py-2 lg:!hidden"
        >
          <div>
            <h2 class="text-sm font-semibold">{{ t('joule.previewTitle') }}</h2>
            <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('joule.previewSubtitle') }}</p>
          </div>
          <button type="button" class="sap-btn sap-btn--ghost !p-2" @click="shell.chatPreviewOpen = false">
            ✕
          </button>
        </div>
        <div class="hidden shrink-0 sap-object-header lg:block">
          <h2 class="text-sm font-semibold">{{ t('joule.previewTitle') }}</h2>
          <p class="text-xs text-[var(--sapContentLabelColor)]">{{ t('joule.previewSubtitle') }}</p>
        </div>
        <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            v-if="chat.isGenerating && chat.requestMode === 'pi_sheet' && !chat.currentPiSheet"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--sapGroupContentBackground)] p-8"
          >
            <AssistantRobot size="md" orb animated active class="opacity-80" />
            <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('joule.building') }}</p>
          </div>
          <PISheetPreview
            v-else
            :sheet="chat.currentPiSheet"
            class="min-h-0 flex-1"
            @sheet-updated="onSheetUpdated"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useShellStore } from '@/stores/shell';
import { resolveChatError } from '@/utils/chatErrors';
import { useToast } from '@/composables/useToast';
import { useNewChat } from '@/composables/useNewChat';
import ChatWelcome from '@/components/chat/ChatWelcome.vue';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import ChatInput from '@/components/chat/ChatInput.vue';
import ChatThinking from '@/components/chat/ChatThinking.vue';
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar.vue';
import PISheetPreview from '@/components/pisheet/PISheetPreview.vue';
import AssistantRobot from '@/components/chat/AssistantRobot.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();
const shell = useShellStore();
const toast = useToast();
const { startNewChat } = useNewChat();
const scrollEl = ref(null);
const chatInputRef = ref(null);
const isMobile = ref(false);

const showWelcome = computed(() => chat.messages.length === 0 && !chat.isGenerating);

const tokenBudgetLine = computed(() => {
  const b = chat.tokenBudget;
  if (!b) return '';
  const used = Number(b.used || 0).toLocaleString();
  if (b.unlimited) return t('chat.tokenBudgetUnlimited', { used });
  const limit = b.budget != null ? ` / ${Number(b.budget).toLocaleString()}` : '';
  return t('chat.tokenBudget', { used, limit });
});
const lastAssistantHasContent = computed(() => {
  const last = chat.messages[chat.messages.length - 1];
  return Boolean(last?.role === 'assistant' && last?.content);
});

function checkMobile() {
  isMobile.value = window.innerWidth < 1024;
}

async function openSheetFromQuery() {
  const id = route.query.piSheet;
  if (!id || typeof id !== 'string') return;
  try {
    await chat.loadPiSheet(id);
    shell.chatPreviewOpen = true;
    const query = { ...route.query };
    delete query.piSheet;
    router.replace({ name: 'chat', query });
  } catch {
    toast.error(t('chat.loadSheetFailed'));
  }
}

onMounted(async () => {
  chat.loadHistory();
  chat.refreshTokenBudget();
  checkMobile();
  window.addEventListener('resize', checkMobile);
  await openSheetFromQuery();
});

watch(() => route.query.piSheet, () => openSheetFromQuery());

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  shell.closeChatPanels();
});

async function scrollToBottom() {
  await nextTick();
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' });
}

async function onSend(prompt, options = {}) {
  try {
    await chat.sendMessage(prompt, options);
    await scrollToBottom();
    if (chat.requestMode === 'pi_sheet') shell.chatPreviewOpen = true;
  } catch (e) {
    toast.error(resolveChatError(e));
    await scrollToBottom();
  }
}

async function onQuickPrompt(item) {
  const text = typeof item === 'string' ? item : item?.text;
  const display = typeof item === 'string' ? undefined : item?.title;
  if (chat.isGenerating || !text?.trim()) return;
  await onSend(text.trim(), { display });
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
