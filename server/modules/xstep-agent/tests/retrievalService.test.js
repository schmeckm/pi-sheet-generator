'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { retrieveMockOnly: retrieve, scoreDocument } = require('../services/retrievalService');

describe('retrievalService', () => {
  it('returns ranked mock results for packaging blister query', () => {
    const result = retrieve({
      query: 'blister packaging line clearance material identification ipc goods movement',
      processArea: 'Packaging',
      packagingType: 'Blister',
      topK: 5,
    });

    assert.ok(result.results.length > 0);
    assert.equal(result.mode, 'keyword-mock');
    assert.ok(result.results.some((r) => r.type === 'xstep'));
    assert.ok(result.results.some((r) => r.type === 'sop'));
  });

  it('filters by metadata', () => {
    const result = retrieve({
      query: 'packaging',
      processArea: 'Packaging',
      packagingType: 'Blister',
      topK: 10,
    });
    for (const item of result.results) {
      if (item.data.processArea) assert.equal(item.data.processArea, 'Packaging');
      if (item.data.packagingType) assert.equal(item.data.packagingType, 'Blister');
    }
  });

  it('scores keyword overlap', () => {
    const score = scoreDocument(
      { name: 'Line Clearance', keywords: ['clearance'], text: 'packaging blister' },
      ['line', 'clearance', 'blister']
    );
    assert.ok(score >= 2);
  });
});
