/**
 * Portal locale (de | en) for LLM-generated operator-facing text.
 */

function normalizeLocale(locale) {
  return locale === 'en' ? 'en' : 'de';
}

const CONFIG = {
  de: {
    languageDirective: `WICHTIG — Portalsprache ist Deutsch:
- Formuliere ALLE operatorensichtbaren Texte im PI-Sheet-JSON auf Deutsch: Titel, Beschreibung, Schrittnamen, Anweisungen, Hinweise, Warnungen sowie neu erstellte Parameterbezeichnungen.
- Technische Kennungen (xstep_id, SAP-Transaktionen, Bewegungsarten) unverändert lassen.
- Repository-XSteps dürfen wörtlich übernommen werden; bei Anpassungen oder neuen Schritten konsequent Deutsch verwenden.`,
    documentContextAppend: `

Dir stehen zusätzlich relevante Auszüge aus Unternehmensdokumenten zur Verfügung (SOPs, Arbeitsanweisungen, Chargenprotokolle, Qualitätsrichtlinien). Nutze diese als Referenz für:
- Korrekte Formulierung von Operatorenanweisungen und firmenspezifische Terminologie
- GMP-konforme Prozessschritte und Dokumentationsanforderungen
- Parameter-Grenzwerte, Toleranzen und Prüfkriterien aus den Dokumenten
Wenn Dokumentauszüge mit XSteps kollidieren, bevorzuge validierte XSteps; ergänze fehlende Details aus den Dokumenten.`,
    mcpContextAppend: `

Datenquellen für PI Sheets:
1. **Lokales Repository** — Die im User-Prompt eingebetteten XSteps und Dokumentauszüge stammen aus der internen Datenbank (validierte Vorlagen). Nutze diese bevorzugt für Standard-Prozessschritte und firmenspezifische Formulierungen.
2. **SAP Live (MCP)** — Wenn der Nutzer Fertigungsaufträge, Stücklisten, Arbeitspläne, Bewegungsarten, Materialstamm oder XSteps nach Linie/Arbeitsplatz aus SAP benötigt, rufe die passenden SAP-MCP-Tools auf (get_process_order, get_bom, get_routing, get_movement_types, get_material_master, get_xsteps).
Entscheide selbst: Repository für validierte Templates; SAP-Tools für aktuelle Auftrags- und Stammdaten. Kombiniere beide Quellen in der finalen JSON-Antwort.`,
    equipmentContextAppend: `

Konfigurierte Produktionsgeräte (Waagen, Sensoren) werden im User-Prompt als JSON mitgeliefert. Für Wägeschritte (type "scale") nur equipment_id aus dieser Liste verwenden — keine erfundenen IDs. Bei fehlender passender Waage Hinweis in warnings statt falscher Referenz.`,
    labels: {
      xsteps: 'Verfügbare XSteps aus dem Repository',
      documents: 'Relevante Dokumente',
      equipment: 'Konfigurierte Geräte (Equipment)',
      userRequest: 'User-Anfrage',
      visionRecognition: 'Erkennung und Matches',
      visionGenerate: 'Generiere das vollständige PI Sheet JSON.',
    },
  },
  en: {
    languageDirective: `IMPORTANT — Portal language is English:
- Write ALL operator-facing text in the PI Sheet JSON in English: title, description, step names, instructions, notes, warnings, and any new parameter labels you create.
- Keep technical identifiers (xstep_id, SAP transaction codes, movement types) unchanged.
- Repository XSteps may be reused verbatim; when adapting or adding steps, use clear English for operators.`,
    documentContextAppend: `

You also have relevant excerpts from company documents (SOPs, work instructions, batch records, quality guidelines). Use them as reference for:
- Correct wording of operator instructions and company-specific terminology
- GMP-compliant process steps and documentation requirements
- Parameter limits, tolerances, and inspection criteria from the documents
If document excerpts conflict with XSteps, prefer validated XSteps; add missing details from the documents.`,
    mcpContextAppend: `

Data sources for PI Sheets:
1. **Local repository** — XSteps and document excerpts embedded in the user prompt come from the internal database (validated templates). Prefer these for standard process steps and company-specific wording.
2. **SAP live (MCP)** — When the user needs manufacturing orders, BOMs, routings, movement types, material master, or XSteps by line/work center from SAP, call the appropriate SAP MCP tools (get_process_order, get_bom, get_routing, get_movement_types, get_material_master, get_xsteps).
Decide yourself: repository for validated templates; SAP tools for current order and master data. Combine both sources in the final JSON response.`,
    equipmentContextAppend: `

Configured production equipment (scales, sensors) is provided as JSON in the user prompt. For weighing steps (type "scale"), use only equipment_id values from that list — do not invent IDs. If no suitable scale exists, add a warning instead of a wrong reference.`,
    labels: {
      xsteps: 'Available XSteps from the repository',
      documents: 'Relevant documents',
      equipment: 'Configured equipment',
      userRequest: 'User request',
      visionRecognition: 'Recognition and matches',
      visionGenerate: 'Generate the complete PI Sheet JSON.',
    },
  },
};

function getLlmLocaleConfig(locale) {
  const loc = normalizeLocale(locale);
  return { locale: loc, ...CONFIG[loc] };
}

function applyLocaleToSystemPrompt(systemPrompt, locale) {
  const { languageDirective } = getLlmLocaleConfig(locale);
  return `${systemPrompt}\n\n${languageDirective}`;
}

module.exports = {
  normalizeLocale,
  getLlmLocaleConfig,
  applyLocaleToSystemPrompt,
};
