import { get } from '@/composables/useApi';

export function getExplorer(processType) {
  return get('/graph/explorer', { params: { process_type: processType } });
}

export function getContext(processType) {
  return get('/graph/context', { params: { process_type: processType } });
}

export function listEdges(params = {}) {
  return get('/graph/edges', { params });
}
