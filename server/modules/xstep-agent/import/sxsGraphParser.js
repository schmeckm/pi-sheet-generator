'use strict';

const { XMLParser } = require('fast-xml-parser');

const sxsParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  trimValues: true,
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return undefined;
}

function pickText(node, ...keys) {
  const val = pick(node, ...keys);
  if (val == null) return undefined;
  if (typeof val === 'object' && val['#text'] != null) return String(val['#text']);
  return String(val);
}

function sanitizeId(id) {
  if (!id) return null;
  return String(id).trim().replace(/\s+/g, '_');
}

/**
 * Rekursiv SAP-Ordnerstruktur → Graph-Knoten & Kanten.
 */
function extractGraphElements(folder, canonicalPayload, parentId = null) {
  if (!folder) return;

  const folderId = sanitizeId(folder.FOLDER_ID);
  if (!folderId) return;

  const folderName = pickText(folder, 'sxs:STEXT', 'STEXT') || 'Unbekannter Ordner';
  const author = pickText(folder, 'sxs:UNAME', 'UNAME') || 'SYSTEM';

  canonicalPayload.nodes.push({
    id: folderId,
    label: 'Folder',
    properties: { name: folderName, sapId: folderId, author },
  });

  if (parentId) {
    canonicalPayload.edges.push({
      from: parentId,
      to: folderId,
      type: 'CONTAINS',
    });
  }

  const subfolders = asArray(pick(folder, 'sxs:FOLDER', 'FOLDER'));
  subfolders.forEach((sub) => extractGraphElements(sub, canonicalPayload, folderId));

  const items = asArray(pick(folder, 'sxs:ITEM', 'ITEM'));
  items.forEach((item) => {
    const itemId = sanitizeId(item.ITEM_ID);
    if (!itemId) return;

    const itemName = pickText(item, 'sxs:STEXT', 'STEXT') || 'Unbenanntes Template';
    const itemAuthor = pickText(item, 'sxs:UNAME', 'UNAME') || author;

    canonicalPayload.nodes.push({
      id: itemId,
      label: 'XStepTemplate',
      properties: { name: itemName, sapId: itemId, author: itemAuthor },
    });

    canonicalPayload.edges.push({
      from: folderId,
      to: itemId,
      type: 'CONTAINS',
    });

    const version = pick(item, 'sxs:VERSION', 'VERSION');
    if (version) {
      const versionId = sanitizeId(version.VERSION_ID) || `${itemId}_V1`;
      const versionName = pickText(version, 'sxs:VERS_NAME', 'VERS_NAME') || '0001';

      canonicalPayload.nodes.push({
        id: versionId,
        label: 'Version',
        properties: {
          versionCode: versionName,
          validTo: pickText(version, 'sxs:DATE_TO', 'DATE_TO') || '99991231',
        },
      });

      canonicalPayload.edges.push({
        from: itemId,
        to: versionId,
        type: 'HAS_VERSION',
      });

      extractSopReferences(item, itemId, canonicalPayload);
      extractNestedXSteps(version, itemId, canonicalPayload);
    } else {
      extractSopReferences(item, itemId, canonicalPayload);
      extractNestedXSteps(item, itemId, canonicalPayload);
    }
  });
}

function extractSopReferences(itemNode, itemId, canonicalPayload) {
  const xmlString = JSON.stringify(itemNode);
  const sopRegex = /SOP-?\d+/gi;
  const foundSops = xmlString.match(sopRegex);
  if (!foundSops) return;

  const uniqueSops = [...new Set(foundSops)];
  uniqueSops.forEach((sopNum) => {
    const cleanSopId = `SOP_${sopNum.replace(/[^a-zA-Z0-9]/g, '')}`;

    canonicalPayload.nodes.push({
      id: cleanSopId,
      label: 'SOP',
      properties: { sopNumber: sopNum.toUpperCase(), source: 'SAP XML' },
    });

    canonicalPayload.edges.push({
      from: itemId,
      to: cleanSopId,
      type: 'REFERENCES_SOP',
    });
  });
}

/**
 * Sucht in VERSION/ITEM nach XStep-ähnlichen Strukturen (XSTEP, STEP, OPERATION).
 */
function extractNestedXSteps(node, parentItemId, canonicalPayload) {
  if (!node || typeof node !== 'object') return;

  const candidates = asArray(
    pick(node, 'sxs:XSTEP', 'XSTEP', 'sxs:STEP', 'STEP', 'sxs:OPERATION', 'OPERATION')
  );

  candidates.forEach((stepNode, idx) => {
    const stepId =
      sanitizeId(stepNode.XSTEP_ID || stepNode.STEP_ID || stepNode.ID || stepNode['@_id']) ||
      `${parentItemId}_STEP_${idx + 1}`;
    const stepName =
      pickText(stepNode, 'sxs:STEXT', 'STEXT', 'sxs:NAME', 'NAME') || `Step ${idx + 1}`;

    canonicalPayload.nodes.push({
      id: stepId,
      label: 'XStep',
      properties: {
        name: stepName,
        sapId: stepId,
        parentItem: parentItemId,
      },
    });

    canonicalPayload.edges.push({
      from: parentItemId,
      to: stepId,
      type: 'CONTAINS',
    });
  });

  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith('@_') || key === 'sxs:STEXT' || key === 'STEXT') continue;
    if (typeof val === 'object') {
      asArray(val).forEach((child) => {
        if (child && typeof child === 'object') extractNestedXSteps(child, parentItemId, canonicalPayload);
      });
    }
  }
}

function dedupeNodes(nodes) {
  const unique = [];
  const seen = new Set();
  for (const node of nodes) {
    if (!node.id || seen.has(node.id)) continue;
    seen.add(node.id);
    unique.push(node);
  }
  return unique;
}

/**
 * Graph-Knoten → flache XStep-Zeilen für PostgreSQL.
 */
function graphNodesToRawSteps(nodes, processType) {
  const xstepLabels = new Set(['XStep', 'XStepTemplate']);
  const rows = [];

  for (const node of nodes) {
    if (!xstepLabels.has(node.label)) continue;
    const props = node.properties || {};
    rows.push({
      id: node.id,
      name: props.name || node.id,
      stepType: inferStepType(props.name || ''),
      processArea: processType,
      packagingType: '',
      category: 'Prozess',
      gmpRelevant: /gmp|freigabe|clearance|sop/i.test(props.name || ''),
      requiresSignature: /signatur|signature|freigabe|clearance/i.test(props.name || ''),
      keywords: props.sopNumber ? [String(props.sopNumber).toLowerCase()] : [],
      parameters: [],
      description: props.parentItem ? `Parent ITEM: ${props.parentItem}` : '',
      _index: rows.length,
    });
  }

  return rows;
}

function inferStepType(name) {
  const n = String(name).toLowerCase();
  if (/line.?clear|linienfreigabe|freigabe/.test(n)) return 'LINE_CLEARANCE';
  if (/material|chargen|batch/.test(n)) return 'MATERIAL_IDENTIFICATION';
  if (/waren|goods|movement|migo/.test(n)) return 'GOODS_MOVEMENT';
  if (/ipc|kontrolle|prüf/.test(n)) return 'IPC_CHECK';
  if (/dokument|record|protokoll/.test(n)) return 'DOCUMENTATION';
  return 'PROCESS';
}

/**
 * Parse SAP SXS_DOCUMENT XML into canonical graph + raw XStep rows.
 * @param {string} xml
 * @param {{ processType?: string }} [options]
 */
function parseSxsXml(xml, options = {}) {
  if (!xml || typeof xml !== 'string') {
    throw new Error('XML input must be a non-empty string');
  }

  const parsedJson = sxsParser.parse(xml);
  const docNode = pick(parsedJson, 'sxs:SXS_DOCUMENT', 'SXS_DOCUMENT');
  if (!docNode) {
    throw new Error('Das hochgeladene XML entspricht nicht dem SAP SXS-Standard (sxs:SXS_DOCUMENT fehlt).');
  }

  const docId = docNode.DOC_ID || 'UNKNOWN_DOC';
  const contentNode = pick(docNode, 'sxs:SXS_CONTENT', 'SXS_CONTENT');
  const rootFolder = contentNode ? pick(contentNode, 'sxs:FOLDER', 'FOLDER') : null;

  if (!rootFolder) {
    throw new Error('Keine logischen Ordnerstrukturen im XML-Inhalt gefunden.');
  }

  const processType = options.processType || 'Import';

  const canonicalPayload = {
    metadata: {
      docId,
      parsedAt: new Date().toISOString(),
      system: 'SAP_PP_PI_XSTEPS',
      processType,
      format: 'sap-sxs',
    },
    nodes: [],
    edges: [],
  };

  extractGraphElements(rootFolder, canonicalPayload);
  canonicalPayload.nodes = dedupeNodes(canonicalPayload.nodes);

  const raw = graphNodesToRawSteps(canonicalPayload.nodes, processType);
  if (raw.length === 0) {
    throw new Error(
      'Keine XStep- oder Template-Knoten im SAP XML gefunden. Prüfen Sie, ob ITEM/XSTEP-Elemente vorhanden sind.'
    );
  }

  return {
    format: 'sap-sxs',
    rootTag: 'sxs:SXS_DOCUMENT',
    raw,
    graph: canonicalPayload,
  };
}

function isSxsDocument(xml) {
  if (!xml || typeof xml !== 'string') return false;
  const trimmed = xml.trim();
  return (
    /<\s*(?:sxs:)?SXS_DOCUMENT\b/i.test(trimmed) ||
    /<\s*(?:sxs:)?SXS_CONTENT\b/i.test(trimmed)
  );
}

module.exports = {
  parseSxsXml,
  isSxsDocument,
  extractGraphElements,
  graphNodesToRawSteps,
};
