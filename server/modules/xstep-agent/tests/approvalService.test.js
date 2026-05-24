'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { saveProposal, getProposal, listProposals, transition, auditLogForProposal } = require('../services/approvalService');

const MOCK_TEMPLATE = {
  templateType: 'PI_SHEET',
  processArea: 'Packaging',
  validationStatus: 'DRAFT_REQUIRES_REVIEW',
  steps: [],
};

describe('approvalService', () => {
  it('creates and retrieves a proposal', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-1');
    assert.ok(entry.id.startsWith('PROP-'));
    assert.equal(entry.status, 'DRAFT_REQUIRES_REVIEW');
    assert.equal(entry.createdBy, 'user-1');

    const retrieved = getProposal(entry.id);
    assert.equal(retrieved.id, entry.id);
  });

  it('follows the approval workflow', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-2');

    const submitted = transition(entry.id, 'submit', 'user-2');
    assert.equal(submitted.status, 'IN_REVIEW');

    const approved = transition(entry.id, 'approve', 'admin-1');
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approvedBy, 'admin-1');

    const archived = transition(entry.id, 'archive', 'admin-1');
    assert.equal(archived.status, 'ARCHIVED');
  });

  it('rejects and allows revision', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-3');
    transition(entry.id, 'submit', 'user-3');
    const rejected = transition(entry.id, 'reject', 'admin-1', 'Missing IPC step');
    assert.equal(rejected.status, 'REJECTED');

    const revised = transition(entry.id, 'revise', 'user-3');
    assert.equal(revised.status, 'DRAFT_REQUIRES_REVIEW');
  });

  it('rejects without comment throws', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-4');
    transition(entry.id, 'submit', 'user-4');
    assert.throws(() => transition(entry.id, 'reject', 'admin-1'), /comment/);
  });

  it('blocks invalid transitions', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-5');
    assert.throws(() => transition(entry.id, 'approve', 'admin-1'), /not allowed/);
  });

  it('generates audit log', () => {
    const entry = saveProposal(MOCK_TEMPLATE, 'user-6');
    transition(entry.id, 'submit', 'user-6');
    const audit = auditLogForProposal(getProposal(entry.id));
    assert.equal(audit.length, 2);
    assert.equal(audit[0].action, 'agent_proposal_created');
    assert.equal(audit[1].action, 'agent_proposal_submit');
  });

  it('lists proposals by status', () => {
    const all = listProposals();
    assert.ok(all.length > 0);
  });
});
