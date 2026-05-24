import { get, post } from '@/composables/useApi';

const PREFIX = '/v1/xstep-agent';

export function getHealth() {
  return get(`${PREFIX}/health`);
}

export function retrieve(payload) {
  return post(`${PREFIX}/retrieve`, payload);
}

export function composeTemplate(payload) {
  return post(`${PREFIX}/compose-template`, payload);
}

export function validateTemplate(template) {
  return post(`${PREFIX}/validate-template`, { template });
}

export function exportXml(template) {
  return post(`${PREFIX}/export-xml`, { template });
}

export function importXml(xml) {
  return post(`${PREFIX}/import-xml`, { xml });
}

export function createProposal(payload) {
  return post(`${PREFIX}/proposals`, payload);
}

export function listProposals(params = {}) {
  return get(`${PREFIX}/proposals`, { params });
}

export function getProposal(id) {
  return get(`${PREFIX}/proposals/${id}`);
}

export function transitionProposal(id, action, comment) {
  return post(`${PREFIX}/proposals/${id}/${action}`, { comment });
}

export function getProposalAudit(id) {
  return get(`${PREFIX}/proposals/${id}/audit`);
}
