import { useI18n } from 'vue-i18n';

const ROLE_I18N_KEYS = {
  admin: 'common.roleAdmin',
  operator: 'common.roleOperator',
  prompt_editor: 'common.rolePromptEditor',
};

/** Localized display label for auth role codes shown in shell/header. */
export function useRoleLabel() {
  const { t } = useI18n();

  function roleLabel(role) {
    const key = ROLE_I18N_KEYS[role];
    return key ? t(key) : role || '';
  }

  return { roleLabel };
}
