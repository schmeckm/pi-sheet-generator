/** Rough context budgeting (~4 chars per token heuristic). */

const DEFAULT_MAX_USER_CHARS = 90000;

function estimateChars(text) {
  return String(text || '').length;
}

function truncateJsonArray(jsonString, maxChars, locale = 'de') {
  if (estimateChars(jsonString) <= maxChars) {
    return { text: jsonString, trimmed: false };
  }
  try {
    const items = JSON.parse(jsonString);
    if (!Array.isArray(items)) {
      return {
        text: jsonString.slice(0, maxChars),
        trimmed: true,
      };
    }
    const note =
      locale === 'en'
        ? '… context truncated for model limit'
        : '… Kontext wegen Modell-Limit gekürzt';
    const out = [];
    let size = 2;
    for (const item of items) {
      const piece = JSON.stringify(item);
      if (size + piece.length + 2 > maxChars) break;
      out.push(item);
      size += piece.length + 1;
    }
  if (out.length === 0 && items.length > 0) {
      out.push(items[0]);
    }
    return {
      text: JSON.stringify(out, null, 2),
      trimmed: out.length < items.length,
      note: out.length < items.length ? note : undefined,
    };
  } catch {
    return {
      text: jsonString.slice(0, maxChars),
      trimmed: true,
    };
  }
}

/**
 * Trim RAG context blocks (priority: documents → xsteps → equipment → graph).
 */
function trimBuildContext(
  { graphJSON, xstepsJSON, docsJSON, equipmentJSON },
  { maxUserContentChars = DEFAULT_MAX_USER_CHARS, locale = 'de' } = {}
) {
  const labelsReserve = 500;
  let budget = Math.max(8000, maxUserContentChars - labelsReserve);
  const trimmedSections = [];

  const parts = {
    docs: truncateJsonArray(docsJSON, Math.floor(budget * 0.35), locale),
    xsteps: { text: xstepsJSON, trimmed: false },
    equipment: { text: equipmentJSON, trimmed: false },
    graph: { text: graphJSON, trimmed: false },
  };

  if (parts.docs.trimmed) trimmedSections.push(locale === 'en' ? 'documents' : 'Dokumente');

  budget -= estimateChars(parts.docs.text);

  const xstepsMax = Math.floor(budget * 0.55);
  parts.xsteps = truncateJsonArray(xstepsJSON, xstepsMax, locale);
  if (parts.xsteps.trimmed) trimmedSections.push('XSteps');
  budget -= estimateChars(parts.xsteps.text);

  parts.equipment = truncateJsonArray(equipmentJSON, Math.floor(budget * 0.45), locale);
  if (parts.equipment.trimmed) trimmedSections.push(locale === 'en' ? 'equipment' : 'Equipment');
  budget -= estimateChars(parts.equipment.text);

  parts.graph = truncateJsonArray(graphJSON, Math.max(2000, budget), locale);
  if (parts.graph.trimmed) trimmedSections.push(locale === 'en' ? 'process graph' : 'Prozessgraph');

  return {
    graphJSON: parts.graph.text,
    xstepsJSON: parts.xsteps.text,
    docsJSON: parts.docs.text,
    equipmentJSON: parts.equipment.text,
    contextTrimmed: trimmedSections.length > 0,
    trimmedSections,
  };
}

module.exports = {
  DEFAULT_MAX_USER_CHARS,
  trimBuildContext,
  estimateChars,
};
