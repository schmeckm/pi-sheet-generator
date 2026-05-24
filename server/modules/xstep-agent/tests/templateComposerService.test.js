'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { composeTemplate, validateTemplate } = require('../services/templateComposerService');

const EXAMPLE_PROMPT =
  'Create a pharmaceutical packaging PI Sheet template for blister packaging including material identification, line clearance, goods movement, IPC checks and electronic signature.';

describe('templateComposerService', () => {
  it('generates packaging template JSON from mock prompt', async () => {
    const template = await composeTemplate({ prompt: EXAMPLE_PROMPT });

    assert.equal(template.templateType, 'PI_SHEET');
    assert.equal(template.processArea, 'Packaging');
    assert.equal(template.packagingType, 'Blister');
    assert.ok(Array.isArray(template.steps));
    assert.ok(template.steps.length >= 5);

    const types = new Set(template.steps.map((s) => s.stepType));
    assert.ok(types.has('LINE_CLEARANCE'));
    assert.ok(types.has('MATERIAL_IDENTIFICATION'));
    assert.ok(types.has('IPC_CHECK'));
    assert.ok(types.has('GOODS_MOVEMENT'));

    assert.ok(['DRAFT_REQUIRES_REVIEW', 'VALID'].includes(template.validationStatus));
    assert.equal(template.audit.noSapWriteBack, true);
    assert.equal(template.audit.humanApprovalRequired, true);
  });

  it('validates template and flags missing mandatory steps', () => {
    const invalid = validateTemplate({
      templateType: 'PI_SHEET',
      processArea: 'Packaging',
      packagingType: 'Blister',
      steps: [
        {
          sequence: 10,
          stepType: 'PROCESS',
          recommendedXStep: 'XSTEP_PACK_BLISTER_FORM',
          gmpRelevant: false,
          requiresSignature: false,
        },
      ],
      validationStatus: 'DRAFT_REQUIRES_REVIEW',
    });

    assert.equal(invalid.validationStatus, 'INVALID');
    assert.ok(invalid.validationIssues.length > 0);
  });

  it('requires prompt', async () => {
    await assert.rejects(() => composeTemplate({ prompt: '' }), /prompt is required/i);
  });
});
