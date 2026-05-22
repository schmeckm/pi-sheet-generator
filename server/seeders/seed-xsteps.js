/**
 * Runnable seed: node seeders/seed-xsteps.js
 * Seeds 2 users, default PromptConfig, 17 XSteps (9 Verpackung + 4 Abfüllung + 4 Granulation).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, initializeDatabase } = require('../config/database');
const { User, XStep, PromptConfig } = require('../models');
const { DEFAULT_SYSTEM_PROMPT } = require('./default-system-prompt');

const ADMIN_EMAIL = 'admin@pisheet.local';
const ADMIN_PASSWORD = 'admin123';
const OPERATOR_EMAIL = 'operator@pisheet.local';
const OPERATOR_PASSWORD = 'operator123';

const SAMPLE_XSTEPS = [
  // —— Verpackung (9) ——
  {
    xstep_id: 'XS-VP-001',
    name: 'Linienclearance',
    category: 'Prozess',
    process_type: 'Verpackung',
    description: 'Freigabe der Verpackungslinie vor Produktionsbeginn.',
    instruction_template:
      'Bestätigen Sie die Linienclearance. Prüfen Sie, dass keine Restbestände des Vorgänger-Produkts vorhanden sind.',
    params: [
      { name: 'Linie', type: 'display' },
      { name: 'Produkt vorher', type: 'input', required: true },
      { name: 'Reinigung bestätigt', type: 'checkbox', required: true },
      { name: 'Visum Produktion', type: 'input', required: true },
      { name: 'Visum QA', type: 'input', required: true },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 1,
  },
  {
    xstep_id: 'XS-VP-002',
    name: 'Materialbereitstellung',
    category: 'Warenbewegung',
    process_type: 'Verpackung',
    description: 'Bereitstellung der Verpackungsmaterialien am Arbeitsplatz.',
    instruction_template:
      'Stellen Sie alle benötigten Verpackungsmaterialien gemäß Stückliste bereit.',
    params: [
      { name: 'Material-Nr.', type: 'input', required: true },
      { name: 'Charge', type: 'input', required: true },
      { name: 'Menge', type: 'input', unit: 'Stk', required: true },
      { name: 'Lagerort', type: 'input', required: true },
    ],
    sap_transaction: 'MIGO',
    sort_order: 2,
  },
  {
    xstep_id: 'XS-VP-003',
    name: 'Wareneingang buchen (311)',
    category: 'Warenbewegung',
    process_type: 'Verpackung',
    description: 'Umlagerung mit Bewegungsart 311.',
    instruction_template:
      'Buchen Sie den Wareneingang der Materialien mit Bewegungsart 311.',
    params: [
      { name: 'Bewegungsart', type: 'display', default_value: '311' },
      { name: 'Werk', type: 'display' },
      { name: 'Lagerort Ab', type: 'input', required: true },
      { name: 'Lagerort Zu', type: 'input', required: true },
      { name: 'Menge', type: 'input', required: true },
    ],
    sap_transaction: 'MIGO',
    movement_type: '311',
    sort_order: 3,
  },
  {
    xstep_id: 'XS-VP-004',
    name: 'Verpackungsprozess starten',
    category: 'Prozess',
    process_type: 'Verpackung',
    description: 'Start des Verpackungsprozesses.',
    instruction_template:
      'Starten Sie den Verpackungsprozess gemäß Arbeitsanweisung. Dokumentieren Sie Maschinenparameter.',
    params: [
      { name: 'Linie', type: 'display' },
      { name: 'Geschwindigkeit', type: 'input', unit: 'Stk/min' },
      { name: 'Format', type: 'input' },
      { name: 'Startzeit', type: 'input', required: true },
    ],
    sort_order: 4,
  },
  {
    xstep_id: 'XS-VP-005',
    name: 'IPC Gewichtskontrolle',
    category: 'Qualität',
    process_type: 'Verpackung',
    description: 'In-Prozess-Kontrolle der Packungsgewichte.',
    instruction_template:
      'Führen Sie die In-Prozess-Kontrolle der Gewichte durch. Dokumentieren Sie Messwerte.',
    params: [
      { name: 'Sollgewicht', type: 'display', unit: 'g' },
      { name: 'Toleranz ±', type: 'display', unit: 'g' },
      { name: 'Messwert 1', type: 'input', unit: 'g', required: true },
      { name: 'Messwert 2', type: 'input', unit: 'g', required: true },
      { name: 'Messwert 3', type: 'input', unit: 'g', required: true },
      { name: 'Ergebnis', type: 'input', required: true },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 5,
  },
  {
    xstep_id: 'XS-VP-006',
    name: 'Etikettierung',
    category: 'Prozess',
    process_type: 'Verpackung',
    description: 'Etikettierung gemäß Vorgabe.',
    instruction_template:
      'Führen Sie die Etikettierung gemäß Etikettiervorgabe durch. Prüfen Sie Lesbarkeit und Vollständigkeit.',
    params: [
      { name: 'Etikett-Typ', type: 'input' },
      { name: 'Druckformat', type: 'input' },
      { name: 'Prüfvermerk', type: 'checkbox', required: true },
    ],
    sort_order: 6,
  },
  {
    xstep_id: 'XS-VP-007',
    name: 'Rückmeldung Verpackung',
    category: 'Rückmeldung',
    process_type: 'Verpackung',
    description: 'Rückmeldung am Fertigungsauftrag.',
    instruction_template: 'Melden Sie den Verpackungsauftrag im SAP zurück.',
    params: [
      { name: 'Auftrag', type: 'input', required: true },
      { name: 'Vorgang', type: 'input', required: true },
      { name: 'Gutmenge', type: 'input', unit: 'Stk', required: true },
      { name: 'Ausschussmenge', type: 'input', unit: 'Stk' },
      { name: 'Mengeneinheit', type: 'display', default_value: 'Stk' },
    ],
    sap_transaction: 'CO11N',
    sort_order: 7,
  },
  {
    xstep_id: 'XS-VP-008',
    name: 'Warenausgang buchen (261)',
    category: 'Warenbewegung',
    process_type: 'Verpackung',
    description: 'Materialverbrauch Bewegungsart 261.',
    instruction_template:
      'Buchen Sie den Warenausgang der verbrauchten Materialien mit Bewegungsart 261.',
    params: [
      { name: 'Material', type: 'input', required: true },
      { name: 'Menge', type: 'input', required: true },
      { name: 'Bewegungsart', type: 'display', default_value: '261' },
      { name: 'Kostenstelle', type: 'input' },
    ],
    sap_transaction: 'MIGO',
    movement_type: '261',
    sort_order: 8,
  },
  {
    xstep_id: 'XS-VP-009',
    name: 'Chargenprotokoll abschließen',
    category: 'Dokumentation',
    process_type: 'Verpackung',
    description: 'Abschluss Chargenprotokoll Verpackung.',
    instruction_template:
      'Schließen Sie das Chargenprotokoll ab. Alle Unterschriften müssen vollständig sein.',
    params: [
      { name: 'Charge', type: 'input', required: true },
      { name: 'Freigabe Produktion', type: 'checkbox', required: true },
      { name: 'Freigabe QA', type: 'checkbox', required: true },
      { name: 'Bemerkungen', type: 'input' },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 9,
  },
  // —— Abfüllung (4) ——
  {
    xstep_id: 'XS-AF-001',
    name: 'Tankbereitstellung',
    category: 'Warenbewegung',
    process_type: 'Abfüllung',
    description: 'Tank an Abfülllinie bereitstellen.',
    instruction_template: 'Bereiten Sie den Produktionstank für die Abfüllung vor.',
    params: [
      { name: 'Tank-Nr.', type: 'input', required: true },
      { name: 'Produkt', type: 'input', required: true },
      { name: 'Charge', type: 'input', required: true },
      { name: 'Volumen', type: 'input', unit: 'L', required: true },
    ],
    sap_transaction: 'MIGO',
    sort_order: 1,
  },
  {
    xstep_id: 'XS-AF-002',
    name: 'Abfüllparameter einstellen',
    category: 'Prozess',
    process_type: 'Abfüllung',
    description: 'Parameter an der Abfüllmaschine einstellen.',
    instruction_template: 'Stellen Sie Füllmenge, Geschwindigkeit und Temperatur gemäß Rezept ein.',
    params: [
      { name: 'Füllmenge', type: 'input', unit: 'ml', required: true },
      { name: 'Geschwindigkeit', type: 'input', unit: 'Stk/min' },
      { name: 'Temperatur', type: 'input', unit: '°C' },
    ],
    sort_order: 2,
  },
  {
    xstep_id: 'XS-AF-003',
    name: 'IPC Füllmengenkontrolle',
    category: 'Qualität',
    process_type: 'Abfüllung',
    description: 'Stichprobenkontrolle Füllmenge.',
    instruction_template: 'Führen Sie die IPC der Füllmengen durch und dokumentieren Sie die Ergebnisse.',
    params: [
      { name: 'Sollfüllmenge', type: 'display', unit: 'ml' },
      { name: 'Toleranz', type: 'display', unit: 'ml' },
      { name: 'Messwert 1', type: 'input', unit: 'ml', required: true },
      { name: 'Messwert 2', type: 'input', unit: 'ml', required: true },
      { name: 'Messwert 3', type: 'input', unit: 'ml', required: true },
      { name: 'Ergebnis', type: 'input', required: true },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 3,
  },
  {
    xstep_id: 'XS-AF-004',
    name: 'Rückmeldung Abfüllung',
    category: 'Rückmeldung',
    process_type: 'Abfüllung',
    description: 'Rückmeldung Abfüllauftrag.',
    instruction_template: 'Melden Sie den Abfüllauftrag im SAP zurück.',
    params: [
      { name: 'Auftrag', type: 'input', required: true },
      { name: 'Vorgang', type: 'input', required: true },
      { name: 'Gutmenge', type: 'input', required: true },
      { name: 'Ausschuss', type: 'input' },
    ],
    sap_transaction: 'CO11N',
    sort_order: 4,
  },
  // —— Granulation (4) ——
  {
    xstep_id: 'XS-GR-001',
    name: 'Rohstoff-Einwaage',
    category: 'Warenbewegung',
    process_type: 'Granulation',
    description: 'Gewichtsbezogene Einwaage (GMP).',
    instruction_template: 'Wiegen Sie die Rohstoffe gemäß Rezeptur auf kalibrierter Waage ein.',
    params: [
      { name: 'Material-Nr.', type: 'display', required: true },
      { name: 'Charge', type: 'input', required: true },
      { name: 'Sollmenge', type: 'display', unit: 'kg', default_value: '25.000', required: true },
      { name: 'Toleranz', type: 'display', unit: '%', default_value: '1' },
      {
        name: 'Einwaage',
        type: 'scale',
        required: true,
        equipment_config: {
          equipment_id: 'W-GR-04',
          target_field: 'Sollmenge',
          tolerance_field: 'Toleranz',
          requires_tare: true,
          requires_stable: true,
          min_stability_ms: 2000,
          four_eyes: true,
          record_raw_data: true,
        },
      },
      { name: 'Waage-ID', type: 'display', default_value: 'W-GR-04' },
      { name: 'Kalibrierung bestätigt', type: 'checkbox', required: true },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 1,
  },
  {
    xstep_id: 'XS-GR-002',
    name: 'Granulierparameter',
    category: 'Prozess',
    process_type: 'Granulation',
    description: 'Granulator-Parameter einstellen.',
    instruction_template: 'Stellen Sie Drehzahl, Sprührate und Temperatur gemäß Rezept ein.',
    params: [
      { name: 'Drehzahl', type: 'input', unit: 'rpm' },
      { name: 'Sprührate', type: 'input', unit: 'g/min' },
      { name: 'Temperatur', type: 'input', unit: '°C' },
      { name: 'Dauer', type: 'input', unit: 'min' },
    ],
    sort_order: 2,
  },
  {
    xstep_id: 'XS-GR-003',
    name: 'IPC Feuchtigkeitsprüfung',
    category: 'Qualität',
    process_type: 'Granulation',
    description: 'IPC Granulatfeuchte.',
    instruction_template: 'Messen Sie die Feuchte gemäß Prüfplan und dokumentieren Sie das Ergebnis.',
    params: [
      { name: 'Sollwert', type: 'display', unit: '%' },
      { name: 'Toleranz', type: 'display', unit: '%' },
      { name: 'Messwert', type: 'input', unit: '%', required: true },
      { name: 'Ergebnis', type: 'input', required: true },
    ],
    gmp_relevant: true,
    signature_required: true,
    sort_order: 3,
  },
  {
    xstep_id: 'XS-GR-004',
    name: 'Rückmeldung Granulation',
    category: 'Rückmeldung',
    process_type: 'Granulation',
    description: 'Rückmeldung Granulationsauftrag.',
    instruction_template: 'Melden Sie den Granulationsauftrag im SAP zurück.',
    params: [
      { name: 'Auftrag', type: 'input', required: true },
      { name: 'Vorgang', type: 'input', required: true },
      { name: 'Ausbeute', type: 'input', unit: 'kg', required: true },
    ],
    sap_transaction: 'CO11N',
    sort_order: 4,
  },
];

async function seedUsers() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const operatorHash = await bcrypt.hash(OPERATOR_PASSWORD, 10);

  const [admin] = await User.findOrCreate({
    where: { email: ADMIN_EMAIL },
    defaults: {
      email: ADMIN_EMAIL,
      password_hash: adminHash,
      name: 'Admin',
      role: 'admin',
    },
  });
  await admin.update({ password_hash: adminHash, name: 'Admin', role: 'admin' });

  const [operator] = await User.findOrCreate({
    where: { email: OPERATOR_EMAIL },
    defaults: {
      email: OPERATOR_EMAIL,
      password_hash: operatorHash,
      name: 'Operator',
      role: 'operator',
    },
  });
  await operator.update({ password_hash: operatorHash, name: 'Operator', role: 'operator' });

  console.log(`Users: ${ADMIN_EMAIL}, ${OPERATOR_EMAIL}`);
  return admin;
}

async function seedPromptConfig(adminId) {
  const [, created] = await PromptConfig.findOrCreate({
    where: { name: 'default' },
    defaults: {
      name: 'default',
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      is_active: true,
      created_by: adminId,
    },
  });

  if (!created) {
    await PromptConfig.update(
      { system_prompt: DEFAULT_SYSTEM_PROMPT, is_active: true, created_by: adminId },
      { where: { name: 'default' } }
    );
  }

  await PromptConfig.update({ is_active: false }, { where: { name: { [Op.ne]: 'default' } } });
  await PromptConfig.update({ is_active: true }, { where: { name: 'default' } });
  console.log('PromptConfig: default (active)');
}

async function seedXSteps(adminUserId) {
  for (const row of SAMPLE_XSTEPS) {
    const defaults = {
      ...row,
      params: row.params || [],
      gmp_relevant: row.gmp_relevant ?? false,
      signature_required: row.signature_required ?? false,
      is_active: true,
      version: 1,
      created_by: adminUserId,
    };

    const [, created] = await XStep.findOrCreate({
      where: { xstep_id: row.xstep_id },
      defaults,
    });

    if (!created) {
      await XStep.update(defaults, { where: { xstep_id: row.xstep_id } });
    }
  }

  const count = await XStep.count();
  console.log(`XSteps seeded: ${count} (expected ${SAMPLE_XSTEPS.length})`);
  return count;
}

async function seedAll() {
  const admin = await seedUsers();
  await seedPromptConfig(admin.id);
  await seedXSteps(admin.id);
  try {
    const { seedSettings } = require('./seed-settings');
    await seedSettings();
  } catch (err) {
    console.warn('[seed] System settings skipped:', err.message);
  }
}

async function run() {
  try {
    await initializeDatabase();
    await seedAll();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { SAMPLE_XSTEPS, seedAll, seedXSteps, seedUsers, seedPromptConfig };
