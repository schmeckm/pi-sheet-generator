import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post } from '@/composables/useApi';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => Boolean(token.value));
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setSession(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }

  function loadFromStorage() {
    token.value = localStorage.getItem('token');
    user.value = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async function login(email, password) {
    const data = await post('/auth/login', { email, password });
    setSession(data.token, data.user);
    return data.user;
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    setSession,
    loadFromStorage,
    login,
    logout,
  };
});
