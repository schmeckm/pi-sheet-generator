'use strict';

const { parseXml } = require('./xmlParser');
const { parseSxsXml, isSxsDocument } = require('./sxsGraphParser');

/**
 * Auto-detect SAP SXS vs. flat XStep export and parse accordingly.
 * @param {string} xml
 * @param {{ processType?: string }} [options]
 */
function parseImportXml(xml, options = {}) {
  if (isSxsDocument(xml)) {
    const result = parseSxsXml(xml, options);
    return {
      format: result.format,
      rootTag: result.rootTag,
      raw: result.raw,
      graph: result.graph,
    };
  }

  const { raw, rootTag } = parseXml(xml);
  return {
    format: 'xstep-flat',
    rootTag,
    raw,
    graph: null,
  };
}

module.exports = { parseImportXml, isSxsDocument };
