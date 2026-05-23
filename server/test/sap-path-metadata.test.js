const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterXStepsBySapPath,
  detectSapPath,
  getXStepSapSystem,
} = require('../utils/sapPathHints');
const importService = require('../services/import.service');

describe('sap-path metadata filter', () => {
  const sample = [
    { xstep_id: 'XS-VP-001', sap_system: null },
    { xstep_id: 'XS-VP-NEW-EWM', sap_system: 'ewm' },
    { xstep_id: 'XS-VP-NEW-MM', sap_system: 'mm' },
    { xstep_id: 'XS-VP-NEW-NONE', sap_system: 'none' },
  ];

  it('keeps ewm + neutral rows on the ewm path (no MM)', () => {
    const out = filterXStepsBySapPath(sample, 'ewm');
    const ids = out.map((x) => x.xstep_id);
    assert.ok(ids.includes('XS-VP-NEW-EWM'));
    assert.ok(ids.includes('XS-VP-NEW-NONE'));
    assert.ok(ids.includes('XS-VP-001'));
    assert.ok(!ids.includes('XS-VP-NEW-MM'));
  });

  it('keeps mm + neutral rows on the mm path (no EWM)', () => {
    const out = filterXStepsBySapPath(sample, 'mm');
    const ids = out.map((x) => x.xstep_id);
    assert.ok(ids.includes('XS-VP-NEW-MM'));
    assert.ok(!ids.includes('XS-VP-NEW-EWM'));
  });

  it('drops both EWM and MM on the none path', () => {
    const out = filterXStepsBySapPath(sample, 'none');
    const ids = out.map((x) => x.xstep_id);
    assert.ok(!ids.includes('XS-VP-NEW-EWM'));
    assert.ok(!ids.includes('XS-VP-NEW-MM'));
    assert.ok(ids.includes('XS-VP-NEW-NONE'));
  });

  it('passes through on auto', () => {
    assert.equal(filterXStepsBySapPath(sample, 'auto').length, sample.length);
  });

  it('falls back to legacy ID heuristic when sap_system is missing', () => {
    assert.equal(getXStepSapSystem({ xstep_id: 'XS-VP-EWM-001' }), 'ewm');
    assert.equal(getXStepSapSystem({ xstep_id: 'XS-VP-003' }), 'mm');
    assert.equal(getXStepSapSystem({ xstep_id: 'XS-VP-001' }), null);
    assert.equal(
      getXStepSapSystem({ xstep_id: 'CUSTOM', sap_transaction: '/SCWM/PACK' }),
      'ewm'
    );
  });

  it('detectSapPath still classifies user prompts', () => {
    assert.equal(detectSapPath('Verpackung mit SAP EWM Handling Unit'), 'ewm');
    assert.equal(detectSapPath('Buche bitte mit MIGO Bewegungsart 311'), 'mm');
    assert.equal(detectSapPath('Nur Rückmeldung ohne Warenbewegung'), 'none');
  });
});

describe('import service normalization', () => {
  it('maps sap_system aliases', () => {
    assert.equal(importService.normalizeSapSystem('EWM'), 'ewm');
    assert.equal(importService.normalizeSapSystem('handling-unit'), 'ewm');
    assert.equal(importService.normalizeSapSystem('MIGO'), 'mm');
    assert.equal(importService.normalizeSapSystem('Rückmeldung'), 'none');
    assert.equal(importService.normalizeSapSystem(''), null);
    assert.equal(importService.normalizeSapSystem('garbage'), null);
  });

  it('parses tag strings from CSV columns', () => {
    assert.deepEqual(
      importService.normalizeTags('Handling-Unit, Goods-Receipt; Movement-311'),
      ['handling-unit', 'goods-receipt', 'movement-311']
    );
    assert.deepEqual(importService.normalizeTags(['A', 'b', '']), ['a', 'b']);
    assert.deepEqual(importService.normalizeTags(null), []);
  });

  it('normalizeXStepData carries sap_system + tags through', () => {
    const out = importService.normalizeXStepData({
      xstep_id: 'XS-X-001',
      name: 'Test',
      category: 'Prozess',
      process_type: 'Verpackung',
      sap_system: 'EWM',
      tags: 'handling-unit, scwm',
    });
    assert.equal(out.sap_system, 'ewm');
    assert.deepEqual(out.tags, ['handling-unit', 'scwm']);
  });
});
