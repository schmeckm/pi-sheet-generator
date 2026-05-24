import { get } from '@/composables/useApi';

export function listDocuments() {
  return get('/knowledge');
}

export function getDocument(id) {
  return get(`/knowledge/${id}`);
}

export function getKnowledgeStats() {
  return get('/knowledge/stats');
}
