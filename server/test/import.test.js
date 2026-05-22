const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const importService = require('../services/import.service');
const parsers = require('../services/import-parsers');

describe('import parsers', () => {
  it('detects format from extension', () => {
    assert.equal(parsers.detectFormat('data.xlsx'), 'excel');
    assert.equal(parsers.detectFormat('pack.zip'), 'zip');
    assert.equal(parsers.detectFormat('steps.xml'), 'xml');
  });

  it('parses JSON array', () => {
    const buf = Buffer.from(
      JSON.stringify([
        {
          xstep_id: 'XS-T-001',
          name: 'Test',
          category: 'Prozess',
          process_type: 'Verpackung',
        },
      ])
    );
    const r = parsers.parseJSON(buf);
    assert.equal(r.xsteps.length, 1);
    assert.equal(r.xsteps[0].xstep_id, 'XS-T-001');
  });

  it('normalizes category alias WB', () => {
    assert.equal(parsers.normalizeCategory('WB'), 'Warenbewegung');
  });
});

describe('import validateRows', () => {
  it('flags missing required fields', () => {
    const r = importService.validateRows([{ name: 'Incomplete' }]);
    assert.equal(r.summary.valid, 0);
    assert.ok(r.summary.errors >= 1);
  });

  it('accepts valid row', () => {
    const r = importService.validateRows([
      {
        xstep_id: 'XS-T-002',
        name: 'OK',
        category: 'Prozess',
        process_type: 'Abfüllung',
      },
    ]);
    assert.equal(r.summary.valid, 1);
    assert.equal(r.valid[0].xstep_id, 'XS-T-002');
  });
});

describe('autoMapColumns', () => {
  it('maps German headers', () => {
    const m = importService.autoMapColumns(['Bezeichnung', 'Schritt_Nr', 'Kategorie', 'Prozesstyp']);
    assert.equal(m.Bezeichnung, 'name');
    assert.ok(Object.values(m).includes('category'));
  });
});
