/** KI-Skill-Governance — DE/EN je nach UI-Sprache (Admin → Hilfe & Architektur) */

export const aiSkillGovernanceBilingualSections = [
  {
    id: 'ai-skill-governance',
    title: 'KI-Skill-Governance & GMP-Validierung',
    titleDe: 'KI-Skill-Governance & GMP-Validierung',
    titleEn: 'AI skill governance & GMP validation',
    bilingual: true,
    image: '/help/ai-skill-governance.png',
    imageZoomable: false,
    imageAltDe: 'Infografik: KI-Skill-Governance — Was die Validierung für GMP-Compliance berücksichtigen muss',
    imageAltEn: 'Infographic: AI skill governance — what validation must consider for GMP compliance',
    locales: {
      de: {
        paragraphs: [
          'Der X-Steps AI Composer ist ein regulierter „KI-Skill“: Entwurfserstellung und Entscheidungsunterstützung — kein autonomer Einsatz in GMP-kritischen Systemen. Jede Nutzung und Validierung sollte die folgenden Governance-Säulen abdecken (Orientierung für IQ/OQ/PQ und GxP-Bewertungen).',
          'Risikoeinstufung (Pilot): Mittel — Auswirkung auf Fertigungsanweisungen bei fehlender Freigabe; Wahrscheinlichkeit durch Workflow, Audit und Hinweise reduziert.',
        ],
        list: [
          {
            label: 'Skill-Überblick',
            text: 'Zweck: PI Sheets aus XStep-Repository, Wissensbasis (RAG) und optional Equipment-Daten entwerfen. Vorgesehene Nutzung: Entscheidungsunterstützung für Operatoren/Planer (Entwürfe). Außerhalb des Scope: autonome Ausführung in GMP-Prozessen, SAP-Rückschreibung, Chargenfreigabe. Nutzen: schnellere PI-Erstellung, konsistente GMP-Schritte, Equipment-Q&A.',
          },
        ],
        tableCaption: 'Governance-Säulen (1–10) — Umsetzung in dieser Anwendung',
        tableCol1: 'Säule',
        tableCol2: 'In X-Steps AI Composer',
        tableCol3: 'Validierung / Hinweise',
        table: [
          ['1 Benutzer & Rollen', 'JWT: operator, admin; Freigabe nur admin', 'RBAC, Least Privilege; ggf. Read-only-Rolle in Produktion'],
          ['2 Datenquellen & Klassifikation', 'XSteps, Wissensbasis-Chunks, optional SAP MCP (Equipment)', 'GMP-Flags auf XSteps; Datenminimierung; Klassifikation dokumentieren'],
          ['3 Zugriff & Autorisierung', 'API nach Rolle; Operatoren: eigene Entwürfe + freigegebene Sheets', 'Kein direkter SAP-Tabellenzugriff; keine Schreibzugriffe auf GMP-Systeme'],
          ['4 MCP & Systemanbindung', 'Optional: SAP MCP (Waagen, OPC-UA/UNS) über Equipment-Gateway', 'Verschlüsselte Verbindung; MCP-URL in Einstellungen; Segregation Non-GMP-Bereich'],
          ['5 Prompt & Output', 'Prompt Config (Versionen, Diff, Test); GMP-Regeln im System-Prompt; JSON-Schema', 'Prompt-Logs/Audit; keine autonomen Qualitätsentscheidungen'],
          ['6 Human-in-the-Loop', 'Workflow: Entwurf → Prüfung → Freigegeben → Archiv; Ablehnen mit Kommentar', 'Alle KI-Ergebnisse beratend; Freigabe durch QA/Produktion (Admin)'],
          ['8 GMP-Grenze & Risiko', 'Kein Write-back; PI Sheets sind Entwürfe; MVP4-Lifecycle', 'GMP-Impact-Assessment; Change Control bei Prompt/Modell-Änderungen'],
          ['9 Validierung & Test', 'Funktionaler Betrieb, Prompt-Test im Admin, specs/playbooks', 'IQ/OQ/PQ nach Unternehmensstandard; Re-Validierung bei Modell/Prompt-Update'],
          ['10 Betrieb & Monitoring', 'Audit-Log, Dashboard-Kennzahlen', 'Incident-Management; periodische Review; Modell-/Prompt-Versionen'],
        ],
        steps: [
          'GMP-Readiness (Kurzcheck): Verwendungszweck definiert — Ja · Daten klassifiziert — teilweise (GMP-Flags) · GMP-Impact bewertet — Mittel · Validierung abgeschlossen — Pilot/in Arbeit · Freigabe Pflicht — Ja (Lifecycle) · Audit-Trail — Ja.',
        ],
      },
      en: {
        paragraphs: [
          'X-Steps AI Composer is a governed “AI skill”: draft creation and decision support — not autonomous use in GMP-critical systems. Every use and validation should cover the governance pillars below (orientation for IQ/OQ/PQ and GxP assessments).',
          'Risk classification (pilot): Medium — impact on manufacturing instructions if approval is skipped; likelihood reduced by workflow, audit trail, and UI disclaimers.',
        ],
        list: [
          {
            label: 'Skill overview',
            text: 'Purpose: draft PI sheets from the XStep repository, knowledge base (RAG), and optional equipment data. Intended use: decision support for operators/planners (drafts only). Out of scope: autonomous execution in GMP processes, SAP write-back, batch release. Value: faster PI drafting, consistent GMP steps, equipment Q&A.',
          },
        ],
        tableCaption: 'Governance pillars (1–10) — implementation in this application',
        tableCol1: 'Pillar',
        tableCol2: 'In X-Steps AI Composer',
        tableCol3: 'Validation / notes',
        table: [
          ['1 Users & roles', 'JWT: operator, admin; release actions admin-only', 'RBAC, least privilege; optional read-only role in production'],
          ['2 Data sources & classification', 'XSteps, knowledge chunks, optional SAP MCP (equipment)', 'GMP flags on XSteps; data minimization; document classification'],
          ['3 Access & authorization', 'API scoped by role; operators: own drafts + approved sheets', 'No direct SAP table access; no write access to GMP systems'],
          ['4 MCP & system interaction', 'Optional: SAP MCP (scales, OPC-UA/UNS) via equipment gateway', 'Encrypted connections; MCP URL in Settings; non-GMP segregation'],
          ['5 Prompt & output controls', 'Prompt config (versions, diff, test); GMP rules in system prompt; JSON schema', 'Prompt logs/audit; no autonomous quality decisions'],
          ['6 Human-in-the-loop', 'Workflow: draft → in review → approved → archived; reject with comment', 'All AI output advisory; release by Production/QA (admin)'],
          ['8 GMP boundary & risk', 'No write-back; PI sheets are drafts; MVP4 lifecycle', 'GMP impact assessment; change control on prompt/model updates'],
          ['9 Validation & testing', 'Functional operation, admin prompt test, specs/playbooks', 'IQ/OQ/PQ per company standard; re-validation on model/prompt change'],
          ['10 Operations & monitoring', 'Audit log, dashboard metrics', 'Incident management; periodic review; model/prompt versioning'],
        ],
        steps: [
          'GMP readiness (quick check): Intended use defined — Yes · Data classified — partial (GMP flags) · GMP impact assessed — Medium · Validation completed — pilot/in progress · Approval required — Yes (lifecycle) · Audit trail — Yes.',
        ],
      },
    },
  },
  {
    id: 'ai-skill-allowed',
    title: 'Erlaubt vs. verboten',
    titleDe: 'Erlaubt vs. verboten',
    titleEn: 'Allowed vs. forbidden',
    bilingual: true,
    locales: {
      de: {
        tableCaption: 'Was der KI-Skill darf und was ausgeschlossen ist (GMP-Grenze)',
        tableCol1: 'Kategorie',
        tableCol2: 'Beispiele',
        table: [
          ['Erlaubt', 'XSteps/Repository lesen, Trends analysieren, GMP-Schritte vorschlagen, PI-Entwürfe und PDF erzeugen, Equipment-Fragen beantworten'],
          ['Verboten', 'In GMP-Systeme schreiben, Chargenstatus ändern, Charge/Los freigeben, Qualitätsdaten aktualisieren, SAP-Transaktionen autonom ausführen'],
        ],
      },
      en: {
        tableCaption: 'What the AI skill may and may not do (GMP boundary)',
        tableCol1: 'Category',
        tableCol2: 'Examples',
        table: [
          ['Allowed', 'Read XSteps/repository, analyze patterns, suggest GMP steps, generate PI drafts and PDF, answer equipment questions'],
          ['Forbidden', 'Write to GMP systems, change batch status, release batch/lot, update quality data, execute SAP transactions autonomously'],
        ],
      },
    },
  },
  {
    id: 'ai-skill-principles',
    title: 'Leitprinzipien',
    titleDe: 'Leitprinzipien',
    titleEn: 'Key principles',
    bilingual: true,
    locales: {
      de: {
        list: [
          { label: 'Datenintegrität & ALCOA+', text: 'Nachvollziehbare Entwürfe, Audit bei Freigabe und Änderungen.' },
          { label: 'Human-in-the-Loop', text: 'Keine autonome Freigabe — Einreichen, Prüfen, Freigeben durch Menschen.' },
          { label: 'Least Privilege', text: 'Operatoren ohne Admin-Rechte; Freigabe gesondert.' },
          { label: 'Transparenz', text: 'GMP-Hinweise in Vorschau, KI-Vorschläge kenntlich, Prompt versioniert.' },
          { label: 'Compliance by Design', text: 'Workflow und Disclaimer von Anfang an im Produkt verankert.' },
        ],
        paragraphs: [
          'Weitere Details: docs/specs/MVP4-SPEC.md (Lifecycle), Admin → PI Sheets (Freigabe), Admin → Audit-Log, Admin → Prompt Config.',
        ],
      },
      en: {
        list: [
          { label: 'Data integrity & ALCOA+', text: 'Traceable drafts; audit on release and changes.' },
          { label: 'Human-in-the-loop', text: 'No autonomous release — submit, review, approve by people.' },
          { label: 'Least privilege', text: 'Operators without admin rights; separate release role.' },
          { label: 'Transparency', text: 'GMP notices in preview; AI suggestions marked; versioned prompts.' },
          { label: 'Compliance by design', text: 'Workflow and disclaimers built into the product.' },
        ],
        paragraphs: [
          'Further details: docs/specs/MVP4-SPEC.md (lifecycle), Admin → PI Sheets (release), Admin → Audit log, Admin → Prompt config.',
        ],
      },
    },
  },
];

const GOVERNANCE_IDS = new Set(aiSkillGovernanceBilingualSections.map((s) => s.id));

export function mergeGovernanceSections(sections) {
  const overviewIdx = sections.findIndex((s) => s.id === 'overview');
  const insertAt = overviewIdx >= 0 ? overviewIdx + 1 : 0;
  const rest = sections.filter((s) => !GOVERNANCE_IDS.has(s.id));
  return [
    ...rest.slice(0, insertAt),
    ...aiSkillGovernanceBilingualSections,
    ...rest.slice(insertAt),
  ];
}
