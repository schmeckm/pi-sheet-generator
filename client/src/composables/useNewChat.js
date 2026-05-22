import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chat';
import { useShellStore } from '@/stores/shell';
import { useConfirm } from '@/composables/useConfirm';

export function useNewChat() {
  const { t } = useI18n();
  const chat = useChatStore();
  const shell = useShellStore();
  const confirm = useConfirm();

  async function startNewChat() {
    if (chat.messages.length === 0 && !chat.isGenerating) {
      chat.resetConversation();
      shell.closeChatPanels();
      return;
    }

    const ok = await confirm.confirm({
      title: t('joule.clearChatTitle'),
      message: chat.isGenerating ? t('joule.clearChatWhileGenerating') : t('joule.clearChatMessage'),
      confirmLabel: t('joule.newChat'),
      variant: 'danger',
    });
    if (!ok) return;

    chat.resetConversation();
    shell.closeChatPanels();
  }

  return { startNewChat };
}
