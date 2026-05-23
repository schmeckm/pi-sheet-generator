import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, patch, post } from '@/composables/useApi';
import { setLocale } from '@/i18n';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
  const profileSynced = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value));
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isPromptEditor = computed(() => user.value?.role === 'prompt_editor');
  const canManagePrompts = computed(() => isAdmin.value || isPromptEditor.value);

  function applyUserLocale(u) {
    const loc = u?.preferred_locale;
    if (loc === 'de' || loc === 'en') setLocale(loc);
  }

  function setSession(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    applyUserLocale(newUser);
  }

  function loadFromStorage() {
    token.value = localStorage.getItem('token');
    user.value = JSON.parse(localStorage.getItem('user') || 'null');
    if (user.value) applyUserLocale(user.value);
  }

  async function login(email, password) {
    const data = await post('/auth/login', { email, password });
    profileSynced.value = true;
    setSession(data.token, data.user);
    return data.user;
  }

  async function ensureProfile() {
    if (!token.value || profileSynced.value) return;
    const data = await get('/auth/me');
    profileSynced.value = true;
    user.value = data.user;
    localStorage.setItem('user', JSON.stringify(data.user));
    applyUserLocale(data.user);
  }

  async function updatePreferredLocale(locale) {
    const data = await patch('/auth/me', { preferred_locale: locale });
    setSession(token.value, data.user);
    profileSynced.value = true;
    return data.user;
  }

  function logout() {
    token.value = null;
    user.value = null;
    profileSynced.value = false;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isPromptEditor,
    canManagePrompts,
    setSession,
    loadFromStorage,
    applyUserLocale,
    ensureProfile,
    updatePreferredLocale,
    login,
    logout,
  };
});
