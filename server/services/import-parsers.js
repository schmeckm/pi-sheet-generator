const { Readable } = require('stream');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { XMLParser } = require('fast-xml-parser');
const AdmZip = require('adm-zip');

const CATEGORY_ALIASES = {
  Warenbewegung: ['warenbewegung', 'wb', 'warenbew', 'goods_movement', 'gm', 'material_movement'],
  Rückmeldung: ['rückmeldung', 'rueckmeldung', 'rm', 'rueckm', 'confirmation', 'conf', 'backflush'],
  Prozess: ['prozess', 'process', 'proc', 'pr', 'production', 'prod'],
  Qualität: ['qualität', 'qualitaet', 'quality', 'qa', 'qc', 'ipc', 'qual'],
  Dokumentation: ['dokumentation', 'documentation', 'dok', 'doc', 'docu', 'protokoll', 'record'],
};

function detectFormat(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.csv')) return 'csv';
  return 'unknown';
}

function stripBom(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3);
  return buf;
}

function detectDelimiter(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  for (const ch of first) {
    if (ch in counts) counts[ch] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ';';
}

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function parseExcel(buffer, options = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;
  let xstepSheet = sheetNames[0];
  let paramSheet = null;
  let instructSheet = null;

  for (const name of sheetNames) {
    const n = name.toLowerCase();
    if (/xstep|step|schritt|master/i.test(n)) xstepSheet = name;
    if (/param|detail/i.test(n)) paramSheet = name;
    if (/instruct|anweis/i.test(n)) instructSheet = name;
  }
  if (options.sheet && wb.Sheets[options.sheet]) xstepSheet = options.sheet;

  const xsteps = sheetToRows(wb.Sheets[xstepSheet]);
  const parameters = paramSheet ? sheetToRows(wb.Sheets[paramSheet]) : [];
  const instructions = instructSheet ? sheetToRows(wb.Sheets[instructSheet]) : [];

  return {
    xsteps,
    parameters,
    instructions,
    metadata: { source_format: 'excel', sheet: xstepSheet, row_count: xsteps.length },
  };
}

function parseJSON(buffer) {
  const parsed = JSON.parse(stripBom(buffer).toString('utf8'));
  if (Array.isArray(parsed)) {
    return { xsteps: parsed, parameters: [], instructions: [], metadata: { source_format: 'json', row_count: parsed.length } };
  }
  if (parsed.xsteps) {
    return {
      xsteps: parsed.xsteps,
      parameters: parsed.parameters || [],
      instructions: parsed.instructions || [],
      metadata: { source_format: 'json', row_count: parsed.xsteps.length },
    };
  }
  throw new Error('JSON must be an array or { xsteps: [...] }');
}

function flattenXmlNode(node) {
  if (node == null) return '';
  if (typeof node !== 'object') return String(node);
  if (node['#text'] !== undefined) return String(node['#text']);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@_')) continue;
    out[k] = typeof v === 'object' && !Array.isArray(v) ? flattenXmlNode(v) : v;
  }
  return out;
}

function parseXML(buffer) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(stripBom(buffer).toString('utf8'));
  const rootKey = Object.keys(doc).find((k) => k !== '?xml') || Object.keys(doc)[0];
  const root = doc[rootKey];
  let items = [];
  if (Array.isArray(root)) items = root;
  else if (root?.XStep) items = Array.isArray(root.XStep) ? root.XStep : [root.XStep];
  else if (root?.Step) items = Array.isArray(root.Step) ? root.Step : [root.Step];
  else if (typeof root === 'object') {
    const childKey = Object.keys(root).find((k) => Array.isArray(root[k]) || typeof root[k] === 'object');
    if (childKey) {
      const child = root[childKey];
      items = Array.isArray(child) ? child : [child];
    }
  }

  const xsteps = items.map((item) => {
    if (typeof item !== 'object') return { name: String(item) };
    const row = {};
    for (const [k, v] of Object.entries(item)) {
      const key = k.replace(/^@_/, '').toLowerCase();
      row[key === 'id' ? 'xstep_id' : key] = flattenXmlNode(v);
    }
    if (item['@_id']) row.xstep_id = item['@_id'];
    return row;
  });

  return {
    xsteps,
    parameters: [],
    instructions: [],
    metadata: { source_format: 'xml', row_count: xsteps.length },
  };
}

function parseCSV(buffer, options = {}) {
  const text = stripBom(buffer).toString(options.encoding === 'latin1' ? 'latin1' : 'utf8');
  const delimiter = options.delimiter && options.delimiter !== 'auto' ? options.delimiter : detectDelimiter(text);

  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(text)
      .pipe(csv({ separator: delimiter === '\t' ? '\t' : delimiter }))
      .on('data', (row) => rows.push(row))
      .on('end', () =>
        resolve({
          xsteps: rows,
          parameters: [],
          instructions: [],
          metadata: { source_format: 'csv', delimiter, row_count: rows.length },
        })
      )
      .on('error', reject);
  });
}

function detectZipRole(name) {
  const n = name.toLowerCase();
  if (/param|detail/i.test(n)) return 'parameters';
  if (/instruct|anweis/i.test(n)) return 'instructions';
  if (/xstep|step|master|data/i.test(n) || /\.(csv|xlsx|json|xml)$/i.test(n)) return 'xsteps';
  return 'unknown';
}

async function parseZip(buffer, fileRoles = {}) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const files = [];
  let xsteps = [];
  let parameters = [];
  let instructions = [];

  for (const entry of entries) {
    const name = entry.entryName;
    const role = fileRoles[name] || detectZipRole(name);
    const ext = detectFormat(name);
    if (ext === 'unknown') continue;

    const data = entry.getData();
    let parsed;
    if (ext === 'excel') parsed = parseExcel(data);
    else if (ext === 'json') parsed = parseJSON(data);
    else if (ext === 'xml') parsed = parseXML(data);
    else if (ext === 'csv') parsed = await parseCSV(data);

    files.push({
      name,
      detected_role: role,
      rows: parsed?.xsteps?.length || 0,
    });

    if (role === 'xsteps' || role === 'unknown') xsteps = xsteps.concat(parsed.xsteps || []);
    if (role === 'parameters') parameters = parameters.concat(parsed.parameters || parsed.xsteps || []);
    if (role === 'instructions') instructions = instructions.concat(parsed.instructions || parsed.xsteps || []);
  }

  return {
    xsteps,
    parameters,
    instructions,
    files,
    metadata: { source_format: 'zip', row_count: xsteps.length, file_count: files.length },
  };
}

async function parseFile(buffer, filename, options = {}, fileRoles = {}) {
  const format = detectFormat(filename);
  if (format === 'zip') return parseZip(buffer, fileRoles);
  if (format === 'excel') return parseExcel(buffer, options);
  if (format === 'json') return parseJSON(buffer);
  if (format === 'xml') return parseXML(buffer);
  if (format === 'csv') return parseCSV(buffer, options);
  throw new Error(`Unsupported format: ${filename}`);
}

function normalizeCategory(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (s.toLowerCase() === canonical.toLowerCase()) return canonical;
    if (aliases.includes(s.toLowerCase())) return canonical;
  }
  return s;
}

module.exports = {
  detectFormat,
  parseFile,
  parseCSV,
  parseExcel,
  parseJSON,
  parseXML,
  parseZip,
  normalizeCategory,
  CATEGORY_ALIASES,
};
