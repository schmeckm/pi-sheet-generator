const { PromptConfigVersion } = require('../models');

async function nextVersionNumber(promptConfigId, transaction) {
  const last = await PromptConfigVersion.findOne({
    where: { prompt_config_id: promptConfigId },
    order: [['version_number', 'DESC']],
    transaction,
  });
  return (last?.version_number || 0) + 1;
}

/**
 * Persist a snapshot of system_prompt (called before overwrite or after create).
 */
async function createSnapshot(
  promptConfigId,
  systemPrompt,
  userId,
  { changeNote = null, transaction = null } = {}
) {
  const version_number = await nextVersionNumber(promptConfigId, transaction);
  return PromptConfigVersion.create(
    {
      prompt_config_id: promptConfigId,
      version_number,
      system_prompt: systemPrompt,
      created_by: userId,
      change_note: changeNote,
    },
    { transaction }
  );
}

async function listVersions(promptConfigId, { limit = 50 } = {}) {
  const rows = await PromptConfigVersion.findAll({
    where: { prompt_config_id: promptConfigId },
    order: [
      ['version_number', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit: Math.min(limit, 100),
    include: [{ association: 'creator', attributes: ['id', 'email', 'name'] }],
  });
  return rows.map((r) => {
    const plain = r.get({ plain: true });
    const text = plain.system_prompt || '';
    return {
      id: plain.id,
      prompt_config_id: plain.prompt_config_id,
      version_number: plain.version_number,
      created_at: plain.created_at,
      change_note: plain.change_note,
      user: plain.creator,
      char_count: text.length,
      excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 200),
      system_prompt: text,
    };
  });
}

async function getVersion(versionId) {
  const row = await PromptConfigVersion.findByPk(versionId, {
    include: [{ association: 'creator', attributes: ['id', 'email', 'name'] }],
  });
  if (!row) return null;
  const plain = row.get({ plain: true });
  return {
    ...plain,
    user: plain.creator,
    char_count: (plain.system_prompt || '').length,
  };
}

function diffStats(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  let same = 0;
  let adds = 0;
  let removes = 0;
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const a = oldLines[i];
    const b = newLines[i];
    if (a === b && a !== undefined) same += 1;
    else {
      if (a !== undefined) removes += 1;
      if (b !== undefined) adds += 1;
    }
  }
  return { same, adds, removes, old_lines: oldLines.length, new_lines: newLines.length };
}

async function compareVersions(leftId, rightId) {
  const [left, right] = await Promise.all([getVersion(leftId), getVersion(rightId)]);
  if (!left || !right) {
    const err = new Error('One or both versions not found');
    err.statusCode = 404;
    throw err;
  }
  if (left.prompt_config_id !== right.prompt_config_id) {
    const err = new Error('Versions must belong to the same prompt configuration');
    err.statusCode = 400;
    throw err;
  }
  return {
    left,
    right,
    stats: diffStats(left.system_prompt, right.system_prompt),
  };
}

module.exports = {
  createSnapshot,
  listVersions,
  getVersion,
  compareVersions,
  diffStats,
};
