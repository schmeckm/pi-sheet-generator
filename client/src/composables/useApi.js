import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  timeout: 180_000,
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      const auth = useAuthStore();
      auth.logout();
      router.push({ name: 'login' });
    }
    return Promise.reject(error);
  }
);

export function get(url, config) {
  return api.get(url, config).then((r) => r.data);
}

export function post(url, data, config) {
  return api.post(url, data, config).then((r) => r.data);
}

export function put(url, data, config) {
  return api.put(url, data, config).then((r) => r.data);
}

export function patch(url, data, config) {
  return api.patch(url, data, config).then((r) => r.data);
}

export function del(url, config) {
  return api.delete(url, config).then((r) => r.data);
}
