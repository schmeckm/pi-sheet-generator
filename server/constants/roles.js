const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  PROMPT_EDITOR: 'prompt_editor',
};

/** Roles that may view and edit prompt configurations (activate: admin only). */
const PROMPT_ACCESS_ROLES = [ROLES.ADMIN, ROLES.PROMPT_EDITOR];

module.exports = { ROLES, PROMPT_ACCESS_ROLES };
