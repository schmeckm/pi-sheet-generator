const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { PISheet, PISheetStep, XStep } = require('../models');
const { logAudit } = require('./audit.service');
const lifecycle = require('./lifecycle.service');

const sheetInclude = [
  { association: 'steps', separate: true, order: [['sort_order', 'ASC']] },
  { association: 'creator', attributes: ['id', 'email', 'name'] },
  { association: 'submitter', attributes: ['id', 'email', 'name'] },
  { association: 'approver', attributes: ['id', 'email', 'name'] },
];

async function findAll(userId, userRole, filters = {}) {
  const where = {};
  if (userRole !== 'admin') {
    where[Op.or] = [
      { created_by: userId },
      { status: { [Op.in]: ['approved', 'archived'] } },
    ];
  }
  if (filters.status) {
    where.status =
      filters.status === 'in_review' ? { [Op.in]: ['in_review', 'review'] } : filters.status;
  }
  if (filters.process_type) where.process_type = filters.process_type;

  return PISheet.findAll({
    where,
    order: [['updated_at', 'DESC']],
    include: sheetInclude,
  });
}

async function findById(id, userId, userRole) {
  return lifecycle.loadSheet(id, userId, userRole);
}

async function updateStatus(id, status, userId, userRole) {
  const map = { review: 'in_review', draft: 'draft', approved: 'approved' };
  const normalized = map[status] || status;
  if (normalized === 'in_review') return lifecycle.transition(id, 'submit', userId, userRole);
  if (normalized === 'approved') return lifecycle.transition(id, 'approve', userId, userRole);
  const sheet = await findById(id, userId, userRole);
  if (!sheet) return null;
  await sheet.update({ status: normalized });
  await logAudit({
    userId,
    action: 'pi_sheet_status_changed',
    entityType: 'pi_sheet',
    entityId: sheet.id,
    details: { status: normalized },
  });
  return findById(id, userId, userRole);
}

async function deleteSheet(id, userId, userRole) {
  const sheet = await findById(id, userId, userRole);
  if (!sheet || sheet.status !== 'draft') {
    const err = new Error('Only draft PI Sheets can be deleted');
    err.statusCode = 400;
    throw err;
  }
  if (userRole !== 'admin' && sheet.created_by !== userId) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  await PISheetStep.destroy({ where: { pi_sheet_id: id } });
  await sheet.destroy();
  await logAudit({
    userId,
    action: 'pi_sheet_deleted',
    entityType: 'pi_sheet',
    entityId: id,
    details: {},
  });
  return true;
}

async function loadSignatureMap(steps) {
  const ids = steps.map((s) => s.xstep_id).filter(Boolean);
  if (!ids.length) return {};
  const xsteps = await XStep.findAll({
    where: { xstep_id: { [Op.in]: ids } },
    attributes: ['xstep_id', 'signature_required', 'gmp_relevant'],
  });
  return Object.fromEntries(xsteps.map((x) => [x.xstep_id, x]));
}

function statusLabel(status) {
  const labels = {
    draft: 'Entwurf',
    in_review: 'In Prüfung',
    approved: 'Freigegeben',
    archived: 'Archiviert',
  };
  return labels[status] || status;
}

function drawStep(doc, step, meta, yStart) {
  let y = yStart;
  const sig = meta[step.xstep_id];

  if (sig?.gmp_relevant) {
    doc.rect(50, y, 495, 18).fill('#fde8e8');
    doc.fillColor('#000');
  }

  doc.fontSize(11).font('Helvetica-Bold');
  doc.text(`${step.step_nr}. ${step.name}`, 50, y, { width: 495 });
  y += 16;
  doc.fontSize(8).font('Helvetica');
  doc.fillColor('#555');
  doc.text(`${step.xstep_id || '—'} · ${step.category || ''}`, 50, y);
  if (step.is_suggestion) {
    doc.fillColor('#b45309').text('  KI-VORSCHLAG', 200, y);
  }
  doc.fillColor('#000');
  y += 14;

  if (step.instruction) {
    doc.fontSize(9).text(step.instruction, 50, y, { width: 495 });
    y += doc.heightOfString(step.instruction, { width: 495 }) + 8;
  }

  const params = step.params || [];
  if (params.length) {
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Parameter', 50, y);
    doc.text('Wert/Eintrag', 200, y);
    doc.text('Pflicht', 420, y);
    y += 12;
    doc.font('Helvetica');
    for (const p of params) {
      doc.text(p.name || '', 50, y);
      doc.text('________________', 200, y);
      doc.text(p.required ? '✕' : '○', 420, y);
      y += 14;
    }
  }

  if (sig?.signature_required) {
    y += 4;
    doc.fontSize(8).text(
      'Durchgeführt: __________ Datum: __________ | Geprüft: __________ Datum: __________',
      50,
      y
    );
    y += 16;
  }

  return y + 10;
}

async function generatePDF(id, userId, userRole) {
  const sheet = await findById(id, userId, userRole);
  if (!sheet) return null;

  const meta = await loadSignatureMap(sheet.steps || []);
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));

  const finished = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));

  const version =
    sheet.status === 'approved'
      ? `1.0 (${statusLabel(sheet.status)})`
      : `0.9 (${statusLabel(sheet.status)})`;

  let page = 1;
  const drawHeader = () => {
    doc.fontSize(14).font('Helvetica-Bold').text('Process Instruction Sheet', 50, 50);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Dok-Nr: PI-${sheet.id.slice(0, 8)}`, 50, 68);
    doc.text(`Version: ${version}`, 200, 68);
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 350, 68);
    doc.text(`Seite: ${page}`, 480, 68);
    doc.fontSize(12).font('Helvetica-Bold').text(sheet.title, 50, 90);
    doc.fontSize(9).font('Helvetica');
    if (sheet.process_type) doc.text(`Prozess: ${sheet.process_type}`, 50, 108);
    if (sheet.description) doc.text(sheet.description, 50, 120, { width: 495 });
    const batch = sheet.batch_number || '__________';
    const order = sheet.order_number || '__________';
    doc.text(`Auftrag: ${order}  Charge: ${batch}  Status: ${statusLabel(sheet.status)}`, 50, 140);
    if (sheet.approved_at && sheet.approver) {
      doc.text(
        `Freigegeben: ${sheet.approver.name || sheet.approver.email} am ${new Date(sheet.approved_at).toLocaleDateString('de-DE')}`,
        50,
        152
      );
      return 172;
    }
    return 160;
  };

  let y = drawHeader();
  for (const step of sheet.steps || []) {
    if (y > 700) {
      doc.addPage();
      page += 1;
      y = drawHeader();
    }
    y = drawStep(doc, step, meta, y);
  }

  if (sheet.notes?.length) {
    y += 8;
    doc.font('Helvetica-Bold').text('Hinweise', 50, y);
    y += 14;
    doc.font('Helvetica');
    for (const note of sheet.notes) {
      doc.text(`• ${note}`, 50, y);
      y += 12;
    }
  }

  if (sheet.warnings?.length) {
    y += 8;
    doc.rect(50, y, 495, 20 + sheet.warnings.length * 12).stroke();
    doc.font('Helvetica-Bold').text('⚠ GMP-Hinweise', 55, y + 4);
    y += 20;
    doc.font('Helvetica');
    for (const w of sheet.warnings) {
      doc.text(`• ${w}`, 55, y);
      y += 12;
    }
  }

  doc.fontSize(7).text(
    'Erstellt: _____ Datum: _____ | Freigegeben: _____ Datum: _____ | QA-Review: _____ Datum: _____',
    50,
    780
  );

  doc.end();
  return finished;
}

module.exports = { findAll, findById, updateStatus, deleteSheet, generatePDF };
