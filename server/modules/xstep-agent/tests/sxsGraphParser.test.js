'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSxsXml, isSxsDocument } = require('../import/sxsGraphParser');
const { parseImportXml } = require('../import/parseImportXml');
const { normalizeAll } = require('../import/normalizer');

const SAMPLE_SXS = `<?xml version="1.0" encoding="UTF-8"?>
<sxs:SXS_DOCUMENT xmlns:sxs="http://sap.com/xs">
  <DOC_ID>DOC_PACK_001</DOC_ID>
  <sxs:SXS_CONTENT>
    <sxs:FOLDER FOLDER_ID="F_ROOT">
      <sxs:STEXT>Verpackung</sxs:STEXT>
      <sxs:UNAME>MMUSTER</sxs:UNAME>
      <sxs:FOLDER FOLDER_ID="F_SUB">
        <sxs:STEXT>Blister Line</sxs:STEXT>
        <sxs:ITEM ITEM_ID="ITEM_LC">
          <sxs:STEXT>Line Clearance Packaging</sxs:STEXT>
          <sxs:UNAME>MMUSTER</sxs:UNAME>
          <sxs:VERSION VERSION_ID="VER_LC_1">
            <sxs:VERS_NAME>0001</sxs:VERS_NAME>
            <sxs:DATE_TO>99991231</sxs:DATE_TO>
            <sxs:XSTEP XSTEP_ID="XS-VP-001">
              <sxs:STEXT>Line Clearance</sxs:STEXT>
            </sxs:XSTEP>
            <sxs:XSTEP XSTEP_ID="XS-VP-002">
              <sxs:STEXT>Material Identification</sxs:STEXT>
            </sxs:XSTEP>
          </sxs:VERSION>
        </sxs:ITEM>
        <sxs:ITEM ITEM_ID="ITEM_SOP">
          <sxs:STEXT>IPC Check SOP-1234</sxs:STEXT>
        </sxs:ITEM>
      </sxs:FOLDER>
    </sxs:FOLDER>
  </sxs:SXS_CONTENT>
</sxs:SXS_DOCUMENT>`;

describe('sxsGraphParser', () => {
  it('detects SAP SXS documents', () => {
    assert.equal(isSxsDocument(SAMPLE_SXS), true);
    assert.equal(isSxsDocument('<XSteps><XStep id="A"/></XSteps>'), false);
  });

  it('parses SXS hierarchy into graph and raw steps', () => {
    const result = parseSxsXml(SAMPLE_SXS, { processType: 'Verpackung' });
    assert.equal(result.format, 'sap-sxs');
    assert.ok(result.graph.nodes.length >= 5);
    assert.ok(result.graph.edges.length >= 3);
    assert.ok(result.raw.length >= 2);

    const xstepIds = result.raw.map((r) => r.id);
    assert.ok(xstepIds.includes('XS-VP-001'));
    assert.ok(xstepIds.includes('XS-VP-002'));

    const sopNode = result.graph.nodes.find((n) => n.label === 'SOP');
    assert.ok(sopNode);
  });

  it('parseImportXml routes SXS vs flat XML', () => {
    const sxs = parseImportXml(SAMPLE_SXS, { processType: 'Verpackung' });
    assert.equal(sxs.format, 'sap-sxs');
    assert.ok(sxs.graph);

    const flat = parseImportXml(
      '<XSteps><XStep id="A"><Name>A</Name></XStep></XSteps>',
      {}
    );
    assert.equal(flat.format, 'xstep-flat');
    assert.equal(flat.graph, null);
  });

  it('normalises SXS raw steps for agent module', () => {
    const { raw } = parseSxsXml(SAMPLE_SXS, { processType: 'Verpackung' });
    const steps = normalizeAll(raw);
    assert.equal(steps[0].processArea, 'Verpackung');
    assert.equal(steps[0].sourceFormat, 'xstep-xml-import');
  });
});
