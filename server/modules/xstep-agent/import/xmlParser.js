'use strict';

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  isArray: (tagName) => ['XStep', 'Step', 'Parameter', 'Keyword'].includes(tagName),
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function attr(node, ...names) {
  for (const name of names) {
    const lower = `@_${name}`;
    const pascal = `@_${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    if (node[lower] != null) return String(node[lower]);
    if (node[pascal] != null) return String(node[pascal]);
  }
  return undefined;
}

function text(node, ...names) {
  for (const name of names) {
    if (node[name] != null) return String(node[name]);
  }
  return undefined;
}

function toBool(raw, fallback = false) {
  if (raw == null) return fallback;
  return String(raw).toLowerCase() === 'true';
}

/**
 * Parse raw XStep XML into an array of plain objects.
 * Accepts multiple root-element conventions used by SAP exports.
 * Does NOT normalise or validate — that happens downstream.
 *
 * @param {string} xml  raw XStep XML string
 * @returns {{ raw: object[], rootTag: string }}
 */
function parseXml(xml) {
  if (!xml || typeof xml !== 'string') {
    throw new Error('XML input must be a non-empty string');
  }

  const doc = parser.parse(xml);

  const rootCandidates = ['XSteps', 'XStepList', 'XStepExport', 'Root'];
  let root = null;
  let rootTag = '';
  for (const tag of rootCandidates) {
    if (doc[tag]) {
      root = doc[tag];
      rootTag = tag;
      break;
    }
  }
  if (!root) {
    root = doc;
    rootTag = Object.keys(doc)[0] || 'unknown';
  }

  const nodes = asArray(root.XStep || root.Step || root.Item);
  if (nodes.length === 0) {
    throw new Error(`No XStep elements found under <${rootTag}>`);
  }

  const raw = nodes.map((node, idx) => ({
    id: attr(node, 'id', 'Id') || text(node, 'Id', 'id') || null,
    name: text(node, 'Name', 'name') || attr(node, 'name', 'Name') || null,
    stepType: text(node, 'StepType', 'stepType') || attr(node, 'stepType', 'StepType') || null,
    processArea: text(node, 'ProcessArea', 'processArea') || attr(node, 'processArea', 'ProcessArea') || null,
    packagingType: text(node, 'PackagingType', 'packagingType') || attr(node, 'packagingType', 'PackagingType') || null,
    category: text(node, 'Category', 'category') || attr(node, 'category', 'Category') || null,
    gmpRelevant: toBool(
      text(node, 'GmpRelevant', 'gmpRelevant') ?? attr(node, 'gmpRelevant', 'GmpRelevant'),
    ),
    requiresSignature: toBool(
      text(node, 'RequiresSignature', 'requiresSignature') ?? attr(node, 'requiresSignature', 'RequiresSignature'),
    ),
    keywords: asArray(node.Keyword || node.keyword || node.Keywords?.Keyword).map(String),
    parameters: asArray(node.Parameter || node.Params?.Parameter).map((p) => ({
      name: attr(p, 'name', 'Name') || text(p, 'Name', 'name') || 'param',
      value: attr(p, 'value', 'Value') || text(p, 'Value', 'value') || '',
      unit: attr(p, 'unit', 'Unit') || text(p, 'Unit', 'unit') || '',
    })),
    _index: idx,
  }));

  return { raw, rootTag };
}

module.exports = { parseXml };
