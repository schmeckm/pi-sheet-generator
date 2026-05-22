import { createI18n } from 'vue-i18n';
import de from './locales/de';
import en from './locales/en';

const STORAGE_KEY = 'pi-sheet-locale';
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const defaultLocale = saved === 'en' || saved === 'de' ? saved : 'de';

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'de',
  messages: { de, en },
});

export function setLocale(locale) {
  if (locale !== 'de' && locale !== 'en') return;
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

document.documentElement.lang = defaultLocale;

export default i18n;
