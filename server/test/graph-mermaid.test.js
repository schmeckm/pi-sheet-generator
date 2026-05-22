const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildMermaidDiagram } = require('../services/graph.service');

describe('buildMermaidDiagram', () => {
  it('includes xstep names and metadata in node labels', () => {
    const xstepsById = new Map([
      [
        'XS-VP-001',
        {
          xstep_id: 'XS-VP-001',
          name: 'Arbeitsplatz vorbereiten',
          category: 'Prozess',
          sap_transaction: null,
          gmp_relevant: false,
        },
      ],
      [
        'XS-VP-002',
        {
          xstep_id: 'XS-VP-002',
          name: 'Materialbereitstellung',
          category: 'Warenbewegung',
          sap_transaction: 'MIGO',
          gmp_relevant: true,
        },
      ],
    ]);

    const diagram = buildMermaidDiagram({
      chain: ['XS-VP-001', 'XS-VP-002'],
      edges: [],
      xstepsById,
      equipmentById: new Map(),
    });

    assert.match(diagram, /Arbeitsplatz vorbereiten/);
    assert.match(diagram, /Materialbereitstellung/);
    assert.match(diagram, /XS-VP-002/);
    assert.match(diagram, /SAP MIGO/);
    assert.match(diagram, /classDef gmpNode/);
    assert.match(diagram, /classDef defaultNode/);
    assert.match(diagram, /classDef sapNode/);
    assert.match(diagram, /class .* gmpNode/);
  });

  it('labels SAP and equipment targets with context', () => {
    const xstepsById = new Map([
      [
        'XS-VP-003',
        {
          xstep_id: 'XS-VP-003',
          name: 'Wareneingang buchen',
          category: 'Warenbewegung',
          sap_transaction: 'MIGO',
          movement_type: '311',
          gmp_relevant: false,
        },
      ],
    ]);
    const equipmentById = new Map([
      [
        'W-GR-05',
        {
          equipment_id: 'W-GR-05',
          name: 'Präzisionswaage Line 3',
          equipment_type: 'scale',
          location: 'VP-L3',
        },
      ],
    ]);

    const diagram = buildMermaidDiagram({
      chain: ['XS-VP-003'],
      edges: [
        {
          edge_type: 'MAPS_TO_SAP',
          from_ref: 'XS-VP-003',
          to_ref: 'MIGO:311',
          metadata: {
            sap_transaction: 'MIGO',
            movement_type: '311',
            xstep_name: 'Wareneingang buchen (311)',
          },
        },
        {
          edge_type: 'USES_EQUIPMENT',
          from_ref: 'XS-VP-005',
          to_ref: 'W-GR-05',
          metadata: { note: 'IPC Gewichtskontrolle' },
        },
      ],
      xstepsById,
      equipmentById,
    });

    assert.match(diagram, /Wareneingang buchen/);
    assert.match(diagram, /MIGO:311/);
    assert.match(diagram, /Präzisionswaage Line 3/);
    assert.match(diagram, /W-GR-05/);
    assert.match(diagram, /classDef equipNode/);
    assert.match(diagram, /equipNode/);
  });
});
