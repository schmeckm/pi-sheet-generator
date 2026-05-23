'use strict';

/**
 * Add explicit SAP-path metadata to xsteps.
 *
 * - sap_system: 'ewm' | 'mm' | 'none' | null
 *     'ewm'  → Handling-Unit / SAP EWM steps (/SCWM/*)
 *     'mm'   → classic SAP MM / MIGO steps (movement types 311/261/…)
 *     'none' → confirmations / IPC / documentation only, no goods movements
 *     null   → unspecified, will fall back to ID-pattern heuristics
 * - tags: free-form JSONB array for additional grouping (e.g. 'handling-unit',
 *     'goods-receipt', 'reconciliation') so the prompt no longer has to enumerate IDs.
 *
 * Backfill is conservative and only touches the well-known seed IDs that the
 * old `filterXStepsBySapPath` already special-cased; other rows stay null and
 * keep the legacy fallback behaviour.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('xsteps');

    if (!desc.sap_system) {
      await queryInterface.addColumn('xsteps', 'sap_system', {
        type: Sequelize.STRING(10),
        allowNull: true,
      });
    }
    if (!desc.tags) {
      await queryInterface.addColumn('xsteps', 'tags', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    await queryInterface.sequelize.query(
      "CREATE INDEX IF NOT EXISTS idx_xsteps_sap_system ON xsteps (sap_system);"
    );
    await queryInterface.sequelize.query(
      "CREATE INDEX IF NOT EXISTS idx_xsteps_tags ON xsteps USING gin (tags);"
    );

    await queryInterface.sequelize.query(`
      UPDATE xsteps SET sap_system = 'ewm'
      WHERE sap_system IS NULL AND xstep_id ILIKE 'XS-VP-EWM-%';
    `);
    await queryInterface.sequelize.query(`
      UPDATE xsteps SET sap_system = 'mm'
      WHERE sap_system IS NULL AND xstep_id IN ('XS-VP-003', 'XS-VP-008');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_xsteps_tags;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_xsteps_sap_system;');
    const desc = await queryInterface.describeTable('xsteps');
    if (desc.tags) await queryInterface.removeColumn('xsteps', 'tags');
    if (desc.sap_system) await queryInterface.removeColumn('xsteps', 'sap_system');
  },
};
