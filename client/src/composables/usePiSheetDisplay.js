import { useI18n } from 'vue-i18n';

/** Canonical process_type values stored in the DB (German). */
const PROCESS_TYPE_I18N_KEYS = {
  Verpackung: 'welcome.caps.packaging',
  Abfüllung: 'welcome.caps.filling',
  Granulation: 'welcome.caps.granulation',
  Tablettierung: 'processTypes.tableting',
  Coating: 'processTypes.coating',
};

/** Exact PI sheet titles often produced in German (longest keys first). */
const EXACT_TITLE_EN = {
  'Standardverpackung Pharmazeutika': 'Standard pharmaceutical packaging',
  'Verpackungsprozess mit Rückmeldungen und Warenbewegungen':
    'Packaging process with confirmations and goods movements',
  'Verpackung mit Rückmeldungen und Warenbewegungen':
    'Packaging with confirmations and goods movements',
  'PI Sheet Abfüllung mit Füllmengen-IPC': 'PI Sheet filling with fill-volume IPC',
  'Abfüllung PI Sheet mit IPC und Chargenprotokoll':
    'Filling PI Sheet with IPC and batch record',
  'Verpackung komplett mit Linienclearance und Etikettierung':
    'Complete packaging with line clearance and labeling',
};

const CATEGORY_EN = {
  Warenbewegung: 'Goods movement',
  Rückmeldung: 'Confirmation',
  Prozess: 'Process',
  Qualität: 'Quality',
  Dokumentation: 'Documentation',
};

/** Substring replacements for German operator text when UI locale is EN (longest first). */
const PHRASE_DE_TO_EN = [
  ['Standardverpackung Pharmazeutika', 'Standard pharmaceutical packaging'],
  ['Verpackungsprozess mit Rückmeldungen und Warenbewegungen',
    'Packaging process with confirmations and goods movements'],
  ['Verpackung mit Rückmeldungen und Warenbewegungen',
    'Packaging with confirmations and goods movements'],
  ['Erstelle ein PI Sheet für', 'Create a PI Sheet for'],
  ['PI Sheet für', 'PI Sheet for'],
  ['PI Sheet Abfüllung mit Füllmengen-IPC', 'PI Sheet filling with fill-volume IPC'],
  ['mit Füllmengen-IPC', 'with fill-volume IPC'],
  ['Füllmengen-IPC', 'fill-volume IPC'],
  ['Chargenprotokoll', 'batch record'],
  ['Linienclearance', 'line clearance'],
  ['Warenbewegungen', 'goods movements'],
  ['Warenbewegung', 'goods movement'],
  ['Rückmeldungen', 'confirmations'],
  ['Rückmeldung', 'confirmation'],
  ['Standardverpackung', 'standard packaging'],
  ['Verpackungsprozess', 'packaging process'],
  ['Pharmazeutika', 'pharmaceuticals'],
  ['Etikettierung', 'labeling'],
  ['Füllmengen', 'fill quantities'],
  ['Füllmenge', 'fill volume'],
  ['Tablettierung', 'tableting'],
  ['Granulation', 'granulation'],
  ['Abfüllung', 'filling'],
  ['Verpackung', 'packaging'],
  ['Materialbereitstellung', 'material staging'],
  ['Linienfreigabe', 'line release'],
  ['Probenahme', 'sampling'],
  ['Freigabe', 'release'],
  ['Bereitstellung', 'staging'],
  ['Prüfung', 'inspection'],
  ['Dokumentation', 'documentation'],
  ['Qualität', 'quality'],
  ['Prozess', 'process'],
  ['Anweisung', 'instruction'],
  ['Operatorenanweisung', 'operator instruction'],
  ['Stückliste', 'bill of materials'],
  ['Charge', 'batch'],
  ['Menge', 'quantity'],
  ['Auftrag', 'order'],
  ['Vorgang', 'operation'],
  ['Gutmenge', 'good quantity'],
  ['Ausschussmenge', 'scrap quantity'],
  ['Maschinenparameter', 'machine parameters'],
  ['Arbeitsanweisung', 'work instruction'],
  ['Produktionstank', 'production tank'],
  ['Abfüllung', 'filling'],
];

function applyPhraseMap(text) {
  let out = text;
  for (const [de, en] of PHRASE_DE_TO_EN) {
    if (out.includes(de)) out = out.split(de).join(en);
  }
  return out;
}

export function usePiSheetDisplay() {
  const { t, locale } = useI18n();

  function localizeProcessType(processType) {
    if (!processType) return processType;
    if (locale.value !== 'en') return processType;
    const key = PROCESS_TYPE_I18N_KEYS[processType];
    return key ? t(key) : processType;
  }

  function localizeText(text) {
    if (!text || locale.value !== 'en') return text;
    if (EXACT_TITLE_EN[text]) return EXACT_TITLE_EN[text];
    return applyPhraseMap(text);
  }

  function localizeCategory(category) {
    if (!category || locale.value !== 'en') return category;
    return CATEGORY_EN[category] || applyPhraseMap(category);
  }

  return { localizeProcessType, localizeText, localizeCategory };
}
