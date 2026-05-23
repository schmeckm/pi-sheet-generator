/**
 * Detect SAP movement path from a free-text user prompt:
 *   - 'ewm'  → Handling-Unit / EWM steps only
 *   - 'mm'   → classic MIGO with movement types
 *   - 'none' → no goods movements at all (confirmations / IPC / docs)
 *   - 'auto' → leave it to the model
 *
 * Used for RAG pre-filtering so the model cannot mix paths it shouldn't.
 *
 * The filter is driven by the XStep `sap_system` and `tags` metadata in the
 * repository (so adding new EWM/MM steps does NOT require code changes).
 * Legacy rows without metadata fall back to a small ID-pattern heuristic
 * so existing installations keep working until they are re-seeded.
 */

const EWM_PATTERNS = [
  /\bewm\b/i,
  /\bhandling[\s-]?unit\b/i,
  /\bhu[\s-]?packen\b/i,
  /\bhu[\s-]?nummer\b/i,
  /\bsscc\b/i,
  /\/scwm\//i,
];

const MM_PATTERNS = [
  /\bmigo\b/i,
  /\bbewegungsart\s*(?:311|261)/i,
  /\b(311|261)\b/,
  /\bsap\s+mm\b/i,
  /\bgoods[- ]?movement\b/i,
];

const NO_MOVEMENT_PATTERNS = [
  /\b(nur|only)\s+(rückmeldung|confirmation)/i,
  /\bohne\s+(warenbewegung|goods movement)/i,
  /\bwithout\s+goods\s+movements?\b/i,
  /\brückmeldung[s-]?orient/i,
  /\bco11n\b/i,
];

function detectSapPath(userPrompt) {
  const text = String(userPrompt || '');
  const hasEwm = EWM_PATTERNS.some((re) => re.test(text));
  const hasMm = MM_PATTERNS.some((re) => re.test(text));
  const noMove = NO_MOVEMENT_PATTERNS.some((re) => re.test(text));

  if (noMove && !hasEwm && !hasMm) return 'none';
  if (hasEwm && !hasMm) return 'ewm';
  if (hasMm && !hasEwm) return 'mm';
  if (hasEwm && hasMm) return 'auto';
  return 'auto';
}

/**
 * Read sap_system from the metadata column with a heuristic fallback for
 * legacy rows that haven't been classified yet (e.g. fresh imports).
 */
function getXStepSapSystem(xstep) {
  const explicit = xstep?.sap_system;
  if (explicit) return String(explicit).toLowerCase();

  const id = String(xstep?.xstep_id || '').toUpperCase();
  const transaction = String(xstep?.sap_transaction || '').toUpperCase();
  if (id.startsWith('XS-VP-EWM-') || transaction.startsWith('/SCWM/')) return 'ewm';
  if (id === 'XS-VP-003' || id === 'XS-VP-008') return 'mm';
  return null;
}

/**
 * Filter retrieved XStep candidates so EWM/MM steps cannot bleed into
 * the wrong sheet.
 *
 * - `sap_system: 'none'` and unspecified (null) steps are kept on every path
 *   (they don't belong to either warehouse pipeline).
 * - `sap_system: 'ewm'` is dropped on the 'mm' and 'none' paths.
 * - `sap_system: 'mm'` is dropped on the 'ewm' and 'none' paths.
 */
function filterXStepsBySapPath(xsteps, sapPath) {
  if (!Array.isArray(xsteps) || sapPath === 'auto' || !sapPath) return xsteps;

  return xsteps.filter((x) => {
    const system = getXStepSapSystem(x);
    if (sapPath === 'ewm') return system !== 'mm';
    if (sapPath === 'mm') return system !== 'ewm';
    if (sapPath === 'none') return system !== 'ewm' && system !== 'mm';
    return true;
  });
}

function sapPathPromptHint(sapPath, locale = 'de') {
  if (!sapPath || sapPath === 'auto') return '';
  const map = {
    de: {
      ewm:
        'Erkannter Pfad: EWM/HU. Verwende ausschließlich XSteps mit `sap_system: "ewm"` ' +
        '(plus pfad-neutrale `sap_system: "none"`/null). KEINE Schritte mit `sap_system: "mm"`.',
      mm:
        'Erkannter Pfad: SAP MM (MIGO). Verwende ausschließlich XSteps mit `sap_system: "mm"` ' +
        '(plus pfad-neutrale `sap_system: "none"`/null). KEINE Schritte mit `sap_system: "ewm"`.',
      none:
        'Erkannter Pfad: nur Rückmeldungen. Verwende ausschließlich XSteps mit ' +
        '`sap_system: "none"` oder `null` — KEINE EWM- oder MM-Warenbewegungen.',
    },
    en: {
      ewm:
        'Detected path: EWM/HU. Use only XSteps with `sap_system: "ewm"` ' +
        '(plus path-neutral `sap_system: "none"`/null). NO `sap_system: "mm"` steps.',
      mm:
        'Detected path: SAP MM (MIGO). Use only XSteps with `sap_system: "mm"` ' +
        '(plus path-neutral `sap_system: "none"`/null). NO `sap_system: "ewm"` steps.',
      none:
        'Detected path: confirmations only. Use only XSteps with `sap_system: "none"` ' +
        'or `null` — NO EWM or MM goods movements.',
    },
  };
  const loc = locale === 'en' ? 'en' : 'de';
  return map[loc][sapPath] || '';
}

module.exports = {
  detectSapPath,
  filterXStepsBySapPath,
  sapPathPromptHint,
  getXStepSapSystem,
};
