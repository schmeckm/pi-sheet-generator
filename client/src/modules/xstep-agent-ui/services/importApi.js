import { get, post, del } from '@/composables/useApi';
import { api } from '@/composables/useApi';

const PREFIX = '/v1/xstep-agent/import';

export function uploadXml(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post(`${PREFIX}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
}

export function parseXmlPreview(xml) {
  return post(`${PREFIX}/parse`, { xml });
}

export function listImports() {
  return get(`${PREFIX}/list`);
}

export function getImport(id) {
  return get(`${PREFIX}/${id}`);
}

export function deleteImport(id) {
  return del(`${PREFIX}/${id}`);
}
