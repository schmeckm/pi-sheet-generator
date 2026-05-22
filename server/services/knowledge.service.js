const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { KnowledgeDocument, DocumentChunk, User, sequelize } = require('../models');
const embeddingService = require('./embedding.service');
const { logAudit } = require('./audit.service');
const graphRagService = require('./graph-rag.service');

const UPLOAD_DIR = path.join(__dirname, '../uploads/knowledge');
const CHUNK_CHARS = 2000;
const CHUNK_OVERLAP = 400;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.txt'];
const CATEGORIES = [
  'SOP',
  'Arbeitsanweisung',
  'Chargenprotokoll',
  'Validierung',
  'Qualitätsrichtlinie',
  'Sonstiges',
];

const processingIds = new Set();

function normalizeFileType(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (!ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
    throw new Error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  return ext;
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function splitTextIntoChunks(text, pageCount = 1) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_CHARS, normalized.length);
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf('\n\n', end);
      if (breakAt > start + CHUNK_CHARS * 0.5) end = breakAt;
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      const pageNumber =
        pageCount > 1
          ? Math.min(pageCount, Math.max(1, Math.ceil((start / normalized.length) * pageCount)))
          : 1;
      chunks.push({
        chunk_index: index,
        content,
        page_number: pageNumber,
        metadata: { char_start: start, char_end: end },
      });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function chunkFromPages(pages) {
  const chunks = [];
  let index = 0;

  for (const page of pages) {
    const pageText = (page.text || '').trim();
    if (!pageText) continue;

    let start = 0;
    while (start < pageText.length) {
      let end = Math.min(start + CHUNK_CHARS, pageText.length);
      if (end < pageText.length) {
        const breakAt = pageText.lastIndexOf('\n\n', end);
        if (breakAt > start + CHUNK_CHARS * 0.5) end = breakAt;
      }

      const content = pageText.slice(start, end).trim();
      if (content) {
        chunks.push({
          chunk_index: index,
          content,
          page_number: page.num,
          metadata: { page: page.num },
        });
        index += 1;
      }

      if (end >= pageText.length) break;
      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
  }

  return chunks;
}

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const pages = (textResult.pages || [])
      .map((p) => ({ num: p.num, text: p.text || '' }))
      .filter((p) => p.text.trim());

    return {
      text: textResult.text || '',
      pageCount: textResult.total || pages.length || 1,
      pages: pages.length ? pages : [{ num: 1, text: textResult.text || '' }],
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || '';
  return { text, pageCount: 1, pages: [{ num: 1, text }] };
}

async function extractXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`## ${sheetName}\n${csv}`);
  }
  const text = parts.join('\n\n');
  return { text, pageCount: workbook.SheetNames.length || 1, pages: [{ num: 1, text }] };
}

async function extractTxt(buffer) {
  const text = buffer.toString('utf8');
  return { text, pageCount: 1, pages: [{ num: 1, text }] };
}

async function extractText(buffer, fileType) {
  switch (fileType) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'xlsx':
      return extractXlsx(buffer);
    case 'txt':
      return extractTxt(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function upload(file, metadata = {}, userId, options = {}) {
  if (!file?.buffer) throw new Error('File required');

  const existing = await KnowledgeDocument.findOne({
    where: { filename: file.originalname },
  });
  if (existing) {
    if (!options.replace) {
      const err = new Error(
        'Ein Dokument mit diesem Dateinamen existiert bereits. Löschen oder „Ersetzen“ wählen.'
      );
      err.statusCode = 409;
      err.existingId = existing.id;
      throw err;
    }
    await deleteDocument(existing.id, userId);
  }

  const fileType = normalizeFileType(file.originalname);
  await ensureUploadDir();

  const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  await fs.writeFile(filePath, file.buffer);

  const title = metadata.title?.trim() || path.parse(file.originalname).name;

  const doc = await KnowledgeDocument.create({
    title,
    filename: file.originalname,
    file_path: filePath,
    file_type: fileType,
    file_size: file.size,
    category: metadata.category || null,
    process_type: metadata.process_type || null,
    status: 'processing',
    uploaded_by: userId,
  });

  await logAudit({
    userId,
    action: 'knowledge_document_uploaded',
    entityType: 'knowledge_document',
    entityId: doc.id,
    details: { title: doc.title, filename: doc.filename },
  });

  processDocument(doc.id).catch((err) => {
    console.error(`Knowledge processing failed for ${doc.id}:`, err.message);
  });

  return doc;
}

async function processDocument(documentId) {
  if (processingIds.has(documentId)) return null;

  const doc = await KnowledgeDocument.findByPk(documentId);
  if (!doc) throw new Error('Document not found');
  if (doc.status === 'ready') {
    return { document: doc, chunks: doc.chunk_count, embedded: 0 };
  }

  processingIds.add(documentId);
  try {
    const buffer = await fs.readFile(doc.file_path);
    const extracted = await extractText(buffer, doc.file_type);

    const rawChunks =
      extracted.pages.length > 1 && doc.file_type === 'pdf'
        ? chunkFromPages(extracted.pages)
        : splitTextIntoChunks(extracted.text, extracted.pageCount);

    if (!rawChunks.length) {
      throw new Error('No text content extracted from document');
    }

    await DocumentChunk.destroy({ where: { document_id: doc.id } });

    const createdChunks = await DocumentChunk.bulkCreate(
      rawChunks.map((c) => ({
        document_id: doc.id,
        chunk_index: c.chunk_index,
        content: c.content,
        page_number: c.page_number,
        metadata: c.metadata,
      }))
    );

    let embeddedCount = 0;
    if (embeddingService.getEmbeddingApiKey()) {
      for (const chunk of createdChunks) {
        const embedding = await embeddingService.generateEmbedding(chunk.content);
        if (embedding) {
          const vectorStr = `[${embedding.join(',')}]`;
          await sequelize.query(
            `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
            { bind: [vectorStr, chunk.id] }
          );
          embeddedCount += 1;
        }
      }
    }

    await doc.update({
      status: 'ready',
      page_count: extracted.pageCount,
      chunk_count: createdChunks.length,
      error_message: null,
    });

    if (doc.process_type) {
      graphRagService.extractFromDocument(doc.id).catch((err) => {
        console.warn(`[graph-rag] extract failed for ${doc.id}:`, err.message);
      });
    }

    return { document: doc, chunks: createdChunks.length, embedded: embeddedCount };
  } catch (err) {
    await doc.update({
      status: 'error',
      error_message: err.message,
    });
    throw err;
  } finally {
    processingIds.delete(documentId);
  }
}

async function searchChunks(queryText, { limit = 10, processType = null } = {}) {
  const embedding = await embeddingService.generateEmbedding(queryText);
  if (!embedding) {
    return keywordSearchChunks(queryText, { limit, processType });
  }

  const vectorStr = `[${embedding.join(',')}]`;
  const binds = [vectorStr];
  let processFilter = '';
  if (processType) {
    binds.push(processType);
    processFilter = `AND kd.process_type = $${binds.length}`;
  }
  binds.push(limit);

  const [rows] = await sequelize.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, dc.page_number, dc.metadata,
            kd.title AS document_title, kd.filename, kd.category, kd.process_type,
            1 - (dc.embedding <=> $1::vector) AS similarity
     FROM document_chunks dc
     INNER JOIN knowledge_documents kd ON kd.id = dc.document_id
     WHERE kd.status = 'ready' AND dc.embedding IS NOT NULL
     ${processFilter}
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $${binds.length}`,
    { bind: binds }
  );

  if (!rows.length) {
    return keywordSearchChunks(queryText, { limit, processType });
  }

  return rows;
}

async function keywordSearchChunks(queryText, { limit = 10, processType = null } = {}) {
  const terms = queryText
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const docWhere = { status: 'ready' };
  if (processType) docWhere.process_type = processType;

  const docs = await KnowledgeDocument.findAll({ where: docWhere, attributes: ['id'] });
  if (!docs.length) return [];

  const chunkWhere = { document_id: { [Op.in]: docs.map((d) => d.id) } };
  if (terms.length) {
    chunkWhere[Op.or] = terms.map((term) => ({
      content: { [Op.iLike]: `%${term}%` },
    }));
  }

  const chunks = await DocumentChunk.findAll({
    where: chunkWhere,
    include: [{ model: KnowledgeDocument, as: 'document', attributes: ['title', 'filename', 'category', 'process_type'] }],
    limit,
    order: [['chunk_index', 'ASC']],
  });

  return chunks.map((c) => ({
    id: c.id,
    document_id: c.document_id,
    chunk_index: c.chunk_index,
    content: c.content,
    page_number: c.page_number,
    metadata: c.metadata,
    document_title: c.document?.title,
    filename: c.document?.filename,
    category: c.document?.category,
    process_type: c.document?.process_type,
    similarity: null,
  }));
}

async function listDocuments() {
  return KnowledgeDocument.findAll({
    order: [['created_at', 'DESC']],
    include: [{ model: User, as: 'uploader', attributes: ['id', 'email'] }],
  });
}

async function getDocument(id) {
  const doc = await KnowledgeDocument.findByPk(id, {
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'email'] },
      { association: 'chunks', attributes: ['id'], separate: true },
    ],
  });
  if (!doc) return null;
  const plain = doc.toJSON();
  plain.chunk_count = plain.chunks?.length ?? doc.chunk_count;
  delete plain.chunks;
  return plain;
}

async function updateDocument(id, data, userId) {
  const doc = await KnowledgeDocument.findByPk(id);
  if (!doc) return null;

  const updates = {};
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.process_type !== undefined) updates.process_type = data.process_type || null;
  if (data.title !== undefined && data.title.trim()) updates.title = data.title.trim();

  await doc.update(updates);
  await logAudit({
    userId,
    action: 'knowledge_document_updated',
    entityType: 'knowledge_document',
    entityId: doc.id,
    details: updates,
  });
  return doc;
}

async function deleteDocument(id, userId) {
  const doc = await KnowledgeDocument.findByPk(id);
  if (!doc) return false;

  try {
    await fs.unlink(doc.file_path);
  } catch {
    /* file may already be missing */
  }

  await doc.destroy();
  await logAudit({
    userId,
    action: 'knowledge_document_deleted',
    entityType: 'knowledge_document',
    entityId: id,
    details: { title: doc.title },
  });
  return true;
}

async function getStats() {
  const [docStats] = await sequelize.query(
    `SELECT COUNT(*)::int AS total_docs,
            COALESCE(SUM(chunk_count), 0)::int AS total_chunks,
            COALESCE(SUM(file_size), 0)::bigint AS total_bytes
     FROM knowledge_documents`
  );

  const [statusRows] = await sequelize.query(
    `SELECT status, COUNT(*)::int AS count FROM knowledge_documents GROUP BY status`
  );

  const byStatus = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const row = docStats[0] || { total_docs: 0, total_chunks: 0, total_bytes: 0 };
  return {
    totalDocs: row.total_docs,
    totalChunks: row.total_chunks,
    totalBytes: Number(row.total_bytes),
    totalMb: Math.round((Number(row.total_bytes) / (1024 * 1024)) * 10) / 10,
    byStatus,
  };
}

module.exports = {
  UPLOAD_DIR,
  CATEGORIES,
  ALLOWED_EXTENSIONS,
  upload,
  processDocument,
  searchChunks,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  getStats,
};
