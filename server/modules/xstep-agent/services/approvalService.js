'use strict';

/**
 * Human approval workflow for XStep Agent template proposals.
 * Templates are not persisted in DB in MVP — this tracks approval state
 * in-memory per session. Future: persist to a dedicated table.
 */

const STATUSES = ['DRAFT_REQUIRES_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];

const TRANSITIONS = {
  DRAFT_REQUIRES_REVIEW: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['ARCHIVED'],
  REJECTED: ['DRAFT_REQUIRES_REVIEW'],
  ARCHIVED: [],
};

const proposals = new Map();

function generateId() {
  return `PROP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveProposal(template, userId) {
  const id = generateId();
  const entry = {
    id,
    template,
    status: template.validationStatus || 'DRAFT_REQUIRES_REVIEW',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    history: [
      {
        action: 'created',
        from: null,
        to: template.validationStatus || 'DRAFT_REQUIRES_REVIEW',
        userId,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  proposals.set(id, entry);
  return entry;
}

function getProposal(id) {
  return proposals.get(id) || null;
}

function listProposals({ status, userId } = {}) {
  let list = [...proposals.values()];
  if (status) list = list.filter((p) => p.status === status);
  if (userId) list = list.filter((p) => p.createdBy === userId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function transition(id, action, userId, comment) {
  const entry = proposals.get(id);
  if (!entry) throw new Error(`Proposal ${id} not found`);

  const actionMap = {
    submit: 'IN_REVIEW',
    approve: 'APPROVED',
    reject: 'REJECTED',
    archive: 'ARCHIVED',
    revise: 'DRAFT_REQUIRES_REVIEW',
  };

  const targetStatus = actionMap[action];
  if (!targetStatus) throw new Error(`Unknown action: ${action}`);

  const allowed = TRANSITIONS[entry.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Cannot ${action}: transition from ${entry.status} to ${targetStatus} is not allowed`
    );
  }

  if (action === 'reject' && !comment) {
    throw new Error('Rejection requires a comment');
  }

  const previousStatus = entry.status;
  entry.status = targetStatus;
  entry.history.push({
    action,
    from: previousStatus,
    to: targetStatus,
    userId,
    comment: comment || null,
    timestamp: new Date().toISOString(),
  });

  if (action === 'approve') {
    entry.approvedBy = userId;
    entry.approvedAt = new Date().toISOString();
  }

  return entry;
}

function auditLogForProposal(entry) {
  if (!entry) return [];
  return (entry.history || []).map((h) => ({
    action: `agent_proposal_${h.action}`,
    entityType: 'xstep_agent_proposal',
    entityId: entry.id,
    userId: h.userId,
    timestamp: h.timestamp,
    details: {
      from: h.from,
      to: h.to,
      comment: h.comment,
    },
  }));
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  saveProposal,
  getProposal,
  listProposals,
  transition,
  auditLogForProposal,
};
