/**
 * Runnable seed: node seeders/seed-graph.js
 * Process graph for Verpackung (FOLLOWS chain) + equipment links.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize, initializeDatabase } = require('../config/database');
const { ProcessGraphEdge } = require('../models');

/** EWM/HU path: MM steps XS-VP-003 / XS-VP-008 remain in repository for non-EWM plants. */
const VERPACKUNG_CHAIN = [
  'XS-VP-001',
  'XS-VP-002',
  'XS-VP-EWM-001',
  'XS-VP-EWM-002',
  'XS-VP-EWM-003',
  'XS-VP-004',
  'XS-VP-005',
  'XS-VP-006',
  'XS-VP-007',
  'XS-VP-EWM-004',
  'XS-VP-010',
  'XS-VP-011',
  'XS-VP-009',
];

const GRANULATION_CHAIN = ['XS-GR-001', 'XS-GR-002', 'XS-GR-005', 'XS-GR-003', 'XS-GR-004'];

function followEdges(processType, chain) {
  const edges = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    edges.push({
      process_type: processType,
      edge_type: 'FOLLOWS',
      from_kind: 'xstep',
      from_ref: chain[i],
      to_kind: 'xstep',
      to_ref: chain[i + 1],
      sort_order: i + 1,
      metadata: {},
    });
  }
  return edges;
}

const SEED_EDGES = [
  ...followEdges('Verpackung', VERPACKUNG_CHAIN),
  {
    process_type: 'Verpackung',
    edge_type: 'USES_EQUIPMENT',
    from_kind: 'xstep',
    from_ref: 'XS-VP-005',
    to_kind: 'equipment',
    to_ref: 'W-GR-05',
    sort_order: 1,
    metadata: { note: 'IPC Gewichtskontrolle — Präzisionswaage' },
  },
  {
    process_type: 'Granulation',
    edge_type: 'USES_EQUIPMENT',
    from_kind: 'xstep',
    from_ref: 'XS-GR-001',
    to_kind: 'equipment',
    to_ref: 'W-GR-04',
    sort_order: 1,
    metadata: { note: 'Rohstoff-Einwaage GMP' },
  },
  {
    process_type: 'Granulation',
    edge_type: 'USES_EQUIPMENT',
    from_kind: 'xstep',
    from_ref: 'XS-GR-005',
    to_kind: 'equipment',
    to_ref: 'T-GR-01',
    sort_order: 2,
    metadata: { note: 'Temperatur-IPC Granulator' },
  },
  ...followEdges('Granulation', GRANULATION_CHAIN),
  ...followEdges('Abfüllung', ['XS-AF-001', 'XS-AF-002', 'XS-AF-003', 'XS-AF-004']),
];

async function seedGraph() {
  await initializeDatabase();

  const removedVp = await ProcessGraphEdge.destroy({
    where: { process_type: 'Verpackung', edge_type: 'FOLLOWS' },
  });
  const removedGr = await ProcessGraphEdge.destroy({
    where: { process_type: 'Granulation', edge_type: 'FOLLOWS' },
  });
  if (removedVp) console.log(`Removed ${removedVp} legacy Verpackung FOLLOWS edge(s).`);
  if (removedGr) console.log(`Removed ${removedGr} legacy Granulation FOLLOWS edge(s).`);

  let created = 0;
  let skipped = 0;

  for (const row of SEED_EDGES) {
    const [, wasCreated] = await ProcessGraphEdge.findOrCreate({
      where: {
        process_type: row.process_type,
        edge_type: row.edge_type,
        from_ref: row.from_ref,
        to_ref: row.to_ref,
      },
      defaults: row,
    });
    if (wasCreated) created += 1;
    else skipped += 1;
  }

  const total = await ProcessGraphEdge.count();
  console.log(
    `Process graph seed: ${created} created, ${skipped} already present (${total} edges total).`
  );
  return { created, skipped, total };
}

async function main() {
  try {
    await seedGraph();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Process graph seed failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SEED_EDGES, seedGraph };
