'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { exportTemplateToXml, importTemplateFromXml, escapeXml } = require('../services/sapExportService');

const SAMPLE_TEMPLATE = {
  templateType: 'PI_SHEET',
  processArea: 'Packaging',
  packagingType: 'Blister',
  validationStatus: 'DRAFT_REQUIRES_REVIEW',
  steps: [
    {
      sequence: 10,
      stepType: 'LINE_CLEARANCE',
      name: 'Line Clearance',
      recommendedXStep: 'XSTEP_PACK_LINE_CLEARANCE',
      gmpRelevant: true,
      requiresSignature: true,
      source: 'rule-engine-fallback',
    },
    {
      sequence: 20,
      stepType: 'MATERIAL_IDENTIFICATION',
      name: 'Material Identification',
      recommendedXStep: 'XSTEP_PACK_MATERIAL_ID',
      gmpRelevant: true,
      requiresSignature: true,
      source: 'retrieval-xstep',
    },
  ],
  audit: { generatedAt: '2026-05-24T18:00:00.000Z' },
};

describe('sapExportService', () => {
  it('exports template to valid XML', () => {
    const xml = exportTemplateToXml(SAMPLE_TEMPLATE);
    assert.ok(xml.includes('<?xml version'));
    assert.ok(xml.includes('<PISheetTemplate'));
    assert.ok(xml.includes('XSTEP_PACK_LINE_CLEARANCE'));
    assert.ok(xml.includes('XSTEP_PACK_MATERIAL_ID'));
    assert.ok(xml.includes('READ ONLY'));
    assert.ok(xml.includes('GmpRelevant="true"'));
  });

  it('round-trips export → import', () => {
    const xml = exportTemplateToXml(SAMPLE_TEMPLATE);
    const imported = importTemplateFromXml(xml);
    assert.equal(imported.templateType, 'PI_SHEET');
    assert.equal(imported.processArea, 'Packaging');
    assert.equal(imported.steps.length, 2);
    assert.equal(imported.steps[0].recommendedXStep, 'XSTEP_PACK_LINE_CLEARANCE');
    assert.equal(imported.steps[0].gmpRelevant, true);
  });

  it('escapes XML special chars', () => {
    assert.equal(escapeXml('a<b>c&d"e'), 'a&lt;b&gt;c&amp;d&quot;e');
  });

  it('throws on missing steps', () => {
    assert.throws(() => exportTemplateToXml({}), /steps array is required/);
  });
});
