import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

/** Top-level shell navigation links (chat, digitalize, admin). */
export function usePrimaryNav() {
  const { t } = useI18n();
  const auth = useAuthStore();

  const links = computed(() => {
    const items = [
      { to: '/chat', label: t('common.chat'), icon: 'chat' },
      { to: '/digitalize', label: t('common.digitalize'), icon: 'digitalize' },
    ];
    if (auth.isAdmin) {
      items.push({ to: '/admin', label: t('common.admin'), icon: 'admin' });
    } else if (auth.canManagePrompts) {
      items.push({ to: '/admin/prompts', label: t('nav.promptConfig'), icon: 'prompt' });
    }
    return items;
  });

  return { links };
}
