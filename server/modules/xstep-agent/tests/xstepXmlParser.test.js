'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseXstepXml } = require('../parsers/xstepXmlParser');

describe('xstepXmlParser', () => {
  it('parses XStep XML into canonical JSON', () => {
    const xml = `
      <XSteps>
        <XStep id="XSTEP_PACK_LINE_CLEARANCE" StepType="LINE_CLEARANCE" GmpRelevant="true" RequiresSignature="true">
          <Name>Line Clearance Packaging</Name>
          <ProcessArea>Packaging</ProcessArea>
          <PackagingType>Blister</PackagingType>
          <Keyword>line clearance</Keyword>
        </XStep>
      </XSteps>
    `;
    const steps = parseXstepXml(xml);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, 'XSTEP_PACK_LINE_CLEARANCE');
    assert.equal(steps[0].stepType, 'LINE_CLEARANCE');
    assert.equal(steps[0].gmpRelevant, true);
    assert.equal(steps[0].requiresSignature, true);
    assert.equal(steps[0].sourceFormat, 'xstep-xml');
  });

  it('throws when XML input is missing', () => {
    assert.throws(() => parseXstepXml(''), /required/i);
  });
});
