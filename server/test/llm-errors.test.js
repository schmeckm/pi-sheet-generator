const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseLlmJson, repairTruncatedJson } = require('../utils/llmErrors');

describe('parseLlmJson', () => {
  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseLlmJson('```json\n{"title":"Test","steps":[{"name":"Step 1"}]}\n```');
    assert.equal(parsed.title, 'Test');
    assert.equal(parsed.steps.length, 1);
  });

  it('repairs truncated PI Sheet JSON', () => {
    const truncated =
      '{"title":"Verpackung Granulat","process_type":"Verpackung","steps":[' +
      '{"step_nr":1,"name":"Wareneingang","category":"Warenbewegung","instruction":"Material prüfen"},' +
      '{"step_nr":2,"name":"Einwaage","category":"Prozess","instruction":"Granulat einwiegen und dokument';

    const repaired = repairTruncatedJson(truncated);
    assert.ok(repaired);
    assert.equal(repaired.title, 'Verpackung Granulat');
    assert.ok(Array.isArray(repaired.steps));
    assert.ok(repaired.steps.length >= 1);
  });

  it('maps max_tokens truncation to PI_TRUNCATED when JSON cannot be repaired', () => {
    assert.throws(
      () => parseLlmJson('{"title":', { stopReason: 'max_tokens' }),
      (err) => err.code === 'PI_TRUNCATED'
    );
  });
});
