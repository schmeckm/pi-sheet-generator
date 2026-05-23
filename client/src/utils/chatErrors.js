import { i18n } from '@/i18n';

/**
 * Map API/SSE `code` to localized chat error text (DE/EN via portal locale).
 */
export function resolveChatError(err) {
  const data = err?.response?.data;
  const code = data?.code || err?.code;
  if (code) {
    const key = `chat.errors.${code}`;
    const params = data?.details || err?.details;
    const translated = i18n.global.t(key, params || {});
    if (translated !== key) return translated;
  }
  return data?.error || err?.message || i18n.global.t('chat.errors.LLM_GENERIC');
}

export function resolveStreamError(payload) {
  if (payload?.code) {
    const key = `chat.errors.${payload.code}`;
    const translated = i18n.global.t(key, payload.details || {});
    if (translated !== key) return translated;
  }
  return payload?.message || i18n.global.t('chat.errors.LLM_GENERIC');
}

export function contextTrimmedMessage(sections = []) {
  const list = Array.isArray(sections) ? sections.join(', ') : String(sections || '');
  return i18n.global.t('chat.contextTrimmed', { sections: list });
}
