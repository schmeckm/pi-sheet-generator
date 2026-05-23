'use strict';

/** Migrate deprecated claude-sonnet-4-20250514 / claude-haiku-4-20250514 defaults. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = 'claude-sonnet-4-6', updated_at = CURRENT_TIMESTAMP
      WHERE key IN ('llm_model_pi_sheet', 'llm_model_vision')
        AND value = 'claude-sonnet-4-20250514'
    `);
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = 'claude-haiku-4-5-20251001', updated_at = CURRENT_TIMESTAMP
      WHERE key = 'llm_model_qa'
        AND value = 'claude-haiku-4-20250514'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = 'claude-sonnet-4-20250514', updated_at = CURRENT_TIMESTAMP
      WHERE key IN ('llm_model_pi_sheet', 'llm_model_vision')
        AND value = 'claude-sonnet-4-6'
    `);
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = 'claude-haiku-4-20250514', updated_at = CURRENT_TIMESTAMP
      WHERE key = 'llm_model_qa'
        AND value = 'claude-haiku-4-5-20251001'
    `);
  },
};
