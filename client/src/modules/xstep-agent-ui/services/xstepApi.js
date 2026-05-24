import { get } from '@/composables/useApi';

export function listXSteps(params = {}) {
  return get('/xsteps', { params });
}

export function getXStep(id) {
  return get(`/xsteps/${id}`);
}
