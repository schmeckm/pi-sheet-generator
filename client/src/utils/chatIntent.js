/** Mirrors server/services/llm.service.js intent routing for UI. */

export function isEquipmentIntent(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const questionPatterns = [
    /welche\s+(waggen|waagen|geräte|gerate|skalen|scales)/,
    /welche\s+.+\s+sind\s+aktiv/,
    /sind\s+(die\s+)?(waggen|waagen|geräte|gerate).*\s+aktiv/,
    /aktive?\s+(waggen|waagen|geräte|gerate)/,
    /gibt\s+es\s+.*(waagen|waggen|equipment)/,
    /which\s+(wagons?|scales?|equipment)/,
    /are\s+.*\s+active/,
    /what\s+equipment/,
    /show\s+.*equipment/,
    /list\s+equipment/,
  ];
  if (questionPatterns.some((re) => re.test(lower))) return true;

  const equipmentHints = [
    'waggon',
    'waggen',
    'waage',
    'waagen',
    'equipment',
    'gerät',
    'geräte',
    'gerate',
    'opc-ua',
    'opc ua',
    'uns',
    'mqtt',
    'namespace',
    'scale',
    'sensor',
    'messwert',
    'verbindung',
  ];
  const looksLikeQuestion = /\?|welche|which|wie viele|how many|zeig|show|list|sind|are|gibt/i.test(
    lower
  );
  return looksLikeQuestion && equipmentHints.some((h) => lower.includes(h));
}

export function isPiSheetIntent(prompt) {
  if (isEquipmentIntent(prompt)) return false;
  const lower = String(prompt || '').toLowerCase();
  const createWords = [
    'erstelle',
    'erzeug',
    'generier',
    'create',
    'generate',
    'pi sheet',
    'pi-sheet',
    'prozessanweisung',
    'process instruction',
    'anweisung',
    'prozessschritt',
    'batch',
    'charge',
  ];
  return createWords.some((w) => lower.includes(w));
}

export function getChatRequestMode(prompt) {
  return isPiSheetIntent(prompt) ? 'pi_sheet' : 'qa';
}
