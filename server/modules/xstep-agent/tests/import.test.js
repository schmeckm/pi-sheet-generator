'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseXml } = require('../import/xmlParser');
const { normalizeAll, normalizeStepType } = require('../import/normalizer');
const { validateBatch } = require('../import/validator');
const { saveImport, listImports, getImport, deleteImport } = require('../import/store');

const STORE_DIR = path.join(__dirname, '..', 'data', 'imports');

function cleanStoreDir() {
  if (fs.existsSync(STORE_DIR)) {
    fs.rmSync(STORE_DIR, { recursive: true, force: true });
  }
}

// ── XML Parser ──

describe('import/xmlParser', () => {
  it('parses well-formed XStep XML', () => {
    const xml = `
      <XSteps>
        <XStep id="XSTEP_001" StepType="LINE_CLEARANCE" GmpRelevant="true" RequiresSignature="true">
          <Name>Line Clearance</Name>
          <ProcessArea>Packaging</ProcessArea>
          <PackagingType>Blister</PackagingType>
          <Keyword>line clearance</Keyword>
          <Keyword>freigabe</Keyword>
        </XStep>
        <XStep id="XSTEP_002">
          <Name>Material Check</Name>
          <StepType>MATERIAL_IDENTIFICATION</StepType>
        </XStep>
      </XSteps>`;
    const { raw, rootTag } = parseXml(xml);
    assert.equal(rootTag, 'XSteps');
    assert.equal(raw.length, 2);
    assert.equal(raw[0].id, 'XSTEP_001');
    assert.equal(raw[0].gmpRelevant, true);
    assert.deepEqual(raw[0].keywords, ['line clearance', 'freigabe']);
    assert.equal(raw[1].stepType, 'MATERIAL_IDENTIFICATION');
  });

  it('accepts XStepList root tag', () => {
    const xml = `<XStepList><XStep id="A"><Name>A</Name></XStep></XStepList>`;
    const { rootTag, raw } = parseXml(xml);
    assert.equal(rootTag, 'XStepList');
    assert.equal(raw.length, 1);
  });

  it('throws on empty input', () => {
    assert.throws(() => parseXml(''), /non-empty/);
    assert.throws(() => parseXml(null), /non-empty/);
  });

  it('throws when no XStep elements are found', () => {
    assert.throws(() => parseXml('<Root><Other>foo</Other></Root>'), /No XStep elements/);
  });

  it('parses parameters', () => {
    const xml = `
      <XSteps>
        <XStep id="P1">
          <Name>Weighing</Name>
          <Parameter name="weight" value="100" unit="kg"/>
          <Parameter name="tolerance" value="5" unit="%"/>
        </XStep>
      </XSteps>`;
    const { raw } = parseXml(xml);
    assert.equal(raw[0].parameters.length, 2);
    assert.equal(raw[0].parameters[0].name, 'weight');
    assert.equal(raw[0].parameters[0].value, '100');
    assert.equal(raw[0].parameters[0].unit, 'kg');
  });
});

// ── Normalizer ──

describe('import/normalizer', () => {
  it('normalises step types via alias map', () => {
    assert.equal(normalizeStepType('LINECLEARANCE'), 'LINE_CLEARANCE');
    assert.equal(normalizeStepType('ipc'), 'IPC_CHECK');
    assert.equal(normalizeStepType(null), 'PROCESS');
    assert.equal(normalizeStepType('MaterialId'), 'MATERIAL_IDENTIFICATION');
  });

  it('generates fallback id and name', () => {
    const normalised = normalizeAll([{ _index: 0, keywords: [], parameters: [] }]);
    assert.equal(normalised[0].id, 'XSTEP_IMPORT_1');
    assert.equal(normalised[0].name, 'Imported Step 1');
    assert.equal(normalised[0].sourceFormat, 'xstep-xml-import');
  });

  it('preserves provided values', () => {
    const normalised = normalizeAll([{
      id: 'MY_ID',
      name: 'My Step',
      stepType: 'IPC',
      processArea: 'Packaging',
      packagingType: 'Blister',
      category: 'Qualität',
      gmpRelevant: true,
      requiresSignature: true,
      keywords: ['  IPC ', 'check'],
      parameters: [{ name: 'temp', value: '25', unit: 'C' }],
      _index: 0,
    }]);
    assert.equal(normalised[0].id, 'MY_ID');
    assert.equal(normalised[0].stepType, 'IPC_CHECK');
    assert.deepEqual(normalised[0].keywords, ['ipc', 'check']);
  });
});

// ── Validator ──

describe('import/validator', () => {
  it('warns on missing id, name, processArea', () => {
    const steps = normalizeAll([{ _index: 0, keywords: [], parameters: [] }]);
    const result = validateBatch(steps);
    assert.ok(result.valid);
    assert.ok(result.warningCount > 0);
    assert.ok(result.warnings.some((w) => w.includes('auto-generated id')));
    assert.ok(result.warnings.some((w) => w.includes('processArea is empty')));
  });

  it('warns on GMP without signature', () => {
    const steps = normalizeAll([{
      id: 'X1', name: 'S', gmpRelevant: true, requiresSignature: false,
      keywords: ['x'], parameters: [], processArea: 'Pack', _index: 0,
    }]);
    const result = validateBatch(steps);
    assert.ok(result.warnings.some((w) => w.includes('requiresSignature is false')));
  });

  it('detects duplicate ids', () => {
    const steps = [
      { id: 'DUP', name: 'A', stepType: 'PROCESS', processArea: 'P', packagingType: '', category: 'Prozess', gmpRelevant: false, requiresSignature: false, keywords: ['a'], parameters: [], sourceFormat: 'xstep-xml-import' },
      { id: 'DUP', name: 'B', stepType: 'PROCESS', processArea: 'P', packagingType: '', category: 'Prozess', gmpRelevant: false, requiresSignature: false, keywords: ['b'], parameters: [], sourceFormat: 'xstep-xml-import' },
    ];
    const result = validateBatch(steps);
    assert.ok(result.warnings.some((w) => w.includes('Duplicate ids')));
  });

  it('returns valid:false for empty batch', () => {
    const result = validateBatch([]);
    assert.equal(result.valid, false);
    assert.ok(result.warnings.some((w) => w.includes('zero steps')));
  });
});

// ── Store ──

describe('import/store', () => {
  beforeEach(() => cleanStoreDir());
  afterEach(() => cleanStoreDir());

  it('saves and retrieves an import', () => {
    const steps = [{ id: 'S1', name: 'Test' }];
    const validation = { warningCount: 0, warnings: [] };
    const record = saveImport({ steps, validation, filename: 'test.xml', userId: 'u1' });

    assert.ok(record.id);
    assert.equal(record.filename, 'test.xml');
    assert.equal(record.stepCount, 1);

    const retrieved = getImport(record.id);
    assert.deepEqual(retrieved.steps, steps);
    assert.equal(retrieved.importedBy, 'u1');
  });

  it('lists imports', () => {
    const validation = { warningCount: 0, warnings: [] };
    saveImport({ steps: [{ id: 'A' }], validation, filename: 'a.xml' });
    saveImport({ steps: [{ id: 'B' }], validation, filename: 'b.xml' });

    const list = listImports();
    assert.equal(list.length, 2);
  });

  it('deletes an import', () => {
    const validation = { warningCount: 0, warnings: [] };
    const record = saveImport({ steps: [{ id: 'D' }], validation, filename: 'd.xml' });
    assert.ok(deleteImport(record.id));
    assert.equal(getImport(record.id), null);
    assert.equal(listImports().length, 0);
  });

  it('returns null for unknown id', () => {
    assert.equal(getImport('nonexistent'), null);
    assert.equal(deleteImport('nonexistent'), false);
  });
});

// ── End-to-end pipeline ──

describe('import pipeline (xml → normalise → validate → store)', () => {
  beforeEach(() => cleanStoreDir());
  afterEach(() => cleanStoreDir());

  it('processes a complete XML through the full pipeline', () => {
    const xml = `
      <XSteps>
        <XStep id="XSTEP_PACK_LC" StepType="LINE_CLEARANCE" GmpRelevant="true" RequiresSignature="true">
          <Name>Line Clearance</Name>
          <ProcessArea>Packaging</ProcessArea>
          <PackagingType>Blister</PackagingType>
          <Keyword>line clearance</Keyword>
        </XStep>
        <XStep id="XSTEP_PACK_MI" StepType="MATERIALID" GmpRelevant="true" RequiresSignature="true">
          <Name>Material Identification</Name>
          <ProcessArea>Packaging</ProcessArea>
          <Keyword>material</Keyword>
        </XStep>
      </XSteps>`;

    const { raw } = parseXml(xml);
    const normalised = normalizeAll(raw);
    const validation = validateBatch(normalised);
    const record = saveImport({ steps: normalised, validation, filename: 'full.xml', userId: 'test' });

    assert.equal(normalised.length, 2);
    assert.equal(normalised[0].stepType, 'LINE_CLEARANCE');
    assert.equal(normalised[1].stepType, 'MATERIAL_IDENTIFICATION');
    assert.ok(validation.valid);

    const stored = getImport(record.id);
    assert.equal(stored.steps.length, 2);
    assert.equal(stored.steps[0].sourceFormat, 'xstep-xml-import');
  });
});
