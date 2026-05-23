'use strict';

/** PI Sheet JSON was truncated at 2500 output tokens (422 PI_JSON_PARSE). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = '8000', updated_at = CURRENT_TIMESTAMP
      WHERE key = 'llm_max_tokens_pi_sheet' AND value = '2500'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE system_settings
      SET value = '2500', updated_at = CURRENT_TIMESTAMP
      WHERE key = 'llm_max_tokens_pi_sheet' AND value = '8000'
    `);
  },
};
