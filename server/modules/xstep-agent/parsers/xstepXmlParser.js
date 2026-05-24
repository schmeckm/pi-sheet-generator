'use strict';

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function getNodeAttr(node, ...names) {
  for (const name of names) {
    if (node[`@_${name}`] != null) return node[`@_${name}`];
    const pascal = `@_${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    if (node[pascal] != null) return node[pascal];
  }
  return undefined;
}

function mapStepType(raw) {
  const normalized = String(raw || '').toUpperCase().replace(/\s+/g, '_');
  const aliases = {
    LINE_CLEARANCE: 'LINE_CLEARANCE',
    LINECLEARANCE: 'LINE_CLEARANCE',
    MATERIAL_IDENTIFICATION: 'MATERIAL_IDENTIFICATION',
    MATERIALID: 'MATERIAL_IDENTIFICATION',
    GOODS_MOVEMENT: 'GOODS_MOVEMENT',
    IPC: 'IPC_CHECK',
    IPC_CHECK: 'IPC_CHECK',
    DOCUMENTATION: 'DOCUMENTATION',
    PROCESS: 'PROCESS',
  };
  return aliases[normalized] || normalized || 'PROCESS';
}

/**
 * Parse SAP-style XStep XML into canonical JSON.
 * @param {string} xml
 * @returns {import('./types').CanonicalXStep[]}
 */
function parseXstepXml(xml) {
  if (!xml || typeof xml !== 'string') {
    throw new Error('XStep XML input is required');
  }

  const doc = parser.parse(xml);
  const root = doc.XSteps || doc.XStepList || doc.Root || doc;
  const nodes = asArray(root.XStep || root.Step || root);

  return nodes.map((node, index) => {
    const params = asArray(node.Parameter || node.Params?.Parameter).map((p) => ({
      name: getNodeAttr(p, 'name', 'Name') || p.Name || p.name || 'param',
      value: getNodeAttr(p, 'value', 'Value') || p.Value || p.value || '',
      unit: getNodeAttr(p, 'unit', 'Unit') || p.Unit || p.unit || '',
    }));

    return {
      id: getNodeAttr(node, 'id', 'Id') || node.Id || node.id || `XSTEP_XML_${index + 1}`,
      name: node.Name || node.name || getNodeAttr(node, 'name', 'Name') || `Step ${index + 1}`,
      stepType: mapStepType(node.StepType || node.stepType || getNodeAttr(node, 'stepType', 'StepType')),
      processArea: node.ProcessArea || node.processArea || getNodeAttr(node, 'processArea', 'ProcessArea') || '',
      packagingType:
        node.PackagingType || node.packagingType || getNodeAttr(node, 'packagingType', 'PackagingType') || '',
      category: node.Category || node.category || getNodeAttr(node, 'category', 'Category') || 'Prozess',
      gmpRelevant:
        String(node.GmpRelevant ?? node.gmpRelevant ?? getNodeAttr(node, 'gmpRelevant', 'GmpRelevant') ?? 'false') ===
        'true',
      requiresSignature:
        String(
          node.RequiresSignature ??
            node.requiresSignature ??
            getNodeAttr(node, 'requiresSignature', 'RequiresSignature') ??
            'false'
        ) === 'true',
      keywords: asArray(node.Keyword || node.Keywords?.Keyword).map(String),
      parameters: params,
      sourceFormat: 'xstep-xml',
    };
  });
}

module.exports = {
  parseXstepXml,
  mapStepType,
};
