const agentArchitecture = {
  de: `┌─────────────────────────────────────────────────────────────────────────┐
│  AI XStep Admin Board (Vue 3 · Pinia · Tailwind)                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Dashboard  │ │ Explorer  │ │ Composer │ │ Review    │ │ Debugger  │  │
│  │ KPIs       │ │ XSteps    │ │ Prompt   │ │ Board     │ │ Retrieval │  │
│  │ Status     │ │ SOPs      │ │ Preview  │ │ Approve   │ │ Scores    │  │
│  │ Activity   │ │ Materials │ │ Evidence │ │ Reject    │ │ Graph Ctx │  │
│  └─────┬─────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
└────────┼─────────────┼────────────┼─────────────┼─────────────┼─────────┘
         │             │            │             │             │
┌────────▼─────────────▼────────────▼─────────────▼─────────────▼─────────┐
│  XStep Agent Backend (Express · Feature Flag: XSTEP_AGENT_ENABLED)      │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ Retrieval    │ │ Template    │ │ Approval     │ │ SAP XML        │   │
│  │ pgvector +   │ │ Composer    │ │ Workflow     │ │ Export/Import  │   │
│  │ Keyword +    │ │ LLM + Rules │ │ State Machine│ │ Round-Trip     │   │
│  │ Graph Chain  │ │ + Graph     │ │ + Audit      │ │                │   │
│  └──────┬───────┘ └──────┬──────┘ └──────┬───────┘ └────────┬───────┘   │
└─────────┼────────────────┼───────────────┼──────────────────┼───────────┘
          │                │               │                  │
          ▼                ▼               ▼                  ▼
   PostgreSQL + pgvector   LLM Provider   Audit Log      SAP BTP (prep)
   XSteps · Knowledge      mock/openai    (best-effort)  (Interface only)
   Graph Edges · PI Sheets`,

  en: `┌─────────────────────────────────────────────────────────────────────────┐
│  AI XStep Admin Board (Vue 3 · Pinia · Tailwind)                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Dashboard  │ │ Explorer  │ │ Composer │ │ Review    │ │ Debugger  │  │
│  │ KPIs       │ │ XSteps    │ │ Prompt   │ │ Board     │ │ Retrieval │  │
│  │ Status     │ │ SOPs      │ │ Preview  │ │ Approve   │ │ Scores    │  │
│  │ Activity   │ │ Materials │ │ Evidence │ │ Reject    │ │ Graph Ctx │  │
│  └─────┬─────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
└────────┼─────────────┼────────────┼─────────────┼─────────────┼─────────┘
         │             │            │             │             │
┌────────▼─────────────▼────────────▼─────────────▼─────────────▼─────────┐
│  XStep Agent Backend (Express · Feature Flag: XSTEP_AGENT_ENABLED)      │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ Retrieval    │ │ Template    │ │ Approval     │ │ SAP XML        │   │
│  │ pgvector +   │ │ Composer    │ │ Workflow     │ │ Export/Import  │   │
│  │ Keyword +    │ │ LLM + Rules │ │ State Machine│ │ Round-Trip     │   │
│  │ Graph Chain  │ │ + Graph     │ │ + Audit      │ │                │   │
│  └──────┬───────┘ └──────┬──────┘ └──────┬───────┘ └────────┬───────┘   │
└─────────┼────────────────┼───────────────┼──────────────────┼───────────┘
          │                │               │                  │
          ▼                ▼               ▼                  ▼
   PostgreSQL + pgvector   LLM Provider   Audit Log      SAP BTP (prep)
   XSteps · Knowledge      mock/openai    (best-effort)  (Interface only)
   Graph Edges · PI Sheets`,
};

const dataFlow = {
  de: `SAP CMXSV XML ──→ XML Parser ──→ Canonical JSON ──→ PostgreSQL ──→ pgvector Embeddings ──→ Knowledge Graph
       │                                                      │
       │                                                      ▼
       └──── CSV/Excel ──→ import-parsers.js ──────→ xsteps Tabelle ──→ embedding.service ──→ Vector Index
                                                              ▲
SOP PDF/DOCX ──→ knowledge.service ──→ Document Chunks ──────┘──→ graph-rag.service ──→ Graph Edges`,

  en: `SAP CMXSV XML ──→ XML Parser ──→ Canonical JSON ──→ PostgreSQL ──→ pgvector Embeddings ──→ Knowledge Graph
       │                                                      │
       │                                                      ▼
       └──── CSV/Excel ──→ import-parsers.js ──────→ xsteps table ──→ embedding.service ──→ Vector Index
                                                              ▲
SOP PDF/DOCX ──→ knowledge.service ──→ Document Chunks ──────┘──→ graph-rag.service ──→ Graph Edges`,
};

export function getXStepAgentHelp(locale) {
  const l = locale === 'en' ? 'en' : 'de';
  return l === 'de' ? helpDe : helpEn;
}

const helpDe = {
  title: 'AI XStep Agent — Dokumentation',
  subtitle: 'Architektur, Datenfluss, Views und API-Referenz',
  toc: 'Inhalt',
  sections: [
    {
      id: 'overview',
      title: 'Überblick',
      paragraphs: [
        'Der AI XStep Agent ist ein isoliertes Modul für KI-gestützte PI Sheet Template-Komposition. Er nutzt bestehende XStep-Daten, SOP-Dokumente und den Prozessgraph, um strukturierte Template-Vorschläge zu generieren.',
        'Das Modul ist hinter dem Feature-Flag XSTEP_AGENT_ENABLED geschützt und kann ohne Auswirkung auf die bestehende Anwendung deaktiviert werden.',
      ],
      list: [
        'Kein SAP Write-Back im MVP',
        'Keine autonome GMP-Genehmigung',
        'Strukturierte JSON-Ausgaben',
        'Vollständige Audit-Nachverfolgung',
        'Human-in-the-Loop Approval Workflow',
      ],
    },
    {
      id: 'architecture',
      title: 'Architektur',
      paragraphs: ['Das System besteht aus 11 Frontend-Views und einem isolierten Backend-Modul:'],
      code: agentArchitecture.de,
    },
    {
      id: 'dataflow',
      title: 'Datenfluss',
      paragraphs: [
        'Daten gelangen über drei Wege ins System: SAP XML Export, CSV/Excel Import und SOP-Dokument-Upload. Alle Daten werden in PostgreSQL gespeichert, mit pgvector-Embeddings indiziert und im Knowledge Graph verknüpft.',
      ],
      code: dataFlow.de,
    },
    {
      id: 'import',
      title: 'Daten-Import',
      paragraphs: ['Es gibt drei Import-Wege für Daten:'],
      list: [
        'XSteps (SAP XML / CSV / Excel): Admin → Repository → Hochladen. Pflichtfelder: xstep_id, name, category, process_type. Deutsche Spaltennamen werden automatisch erkannt.',
        'SOP-Dokumente (PDF / DOCX / TXT): Admin → Wissensbasis → Hochladen. Dokumente werden automatisch gechunkt und mit Embeddings versehen.',
        'Prozessgraph: Wird automatisch aus SOP-Uploads extrahiert (GraphRAG). QA bestätigt oder lehnt Vorschläge ab.',
      ],
    },
    {
      id: 'views',
      title: 'Views (11)',
      paragraphs: ['Das Admin Board besteht aus folgenden Views:'],
      list: [
        'Dashboard — KPIs, Systemstatus, letzte Aktivitäten, Quick Actions',
        'Material Explorer — Materialien und Rezeptur-Zuordnungen (Mock-Daten / SAP)',
        'Recipe Explorer — Master-Rezepturen mit Op/Phase/XStep-Hierarchie',
        'XStep Browser — Suche, Filter, Pagination, Detail-Drawer mit allen Feldern',
        'SOP Browser — Dokument-Cards mit Chunks, Kategorie- und Prozess-Filter',
        'Template Composer — NL-Prompt → KI-Template, Validation, Evidence, XML Export',
        'Review Board — Approval Workflow: Submit → Review → Approve/Reject → Archive',
        'Retrieval Debugger — Explainability: Scores, Graph-Kontext, Rohdaten',
        'Knowledge Graph — Prozesskette, Nodes, Edges, Equipment, Mermaid',
        'Audit Trail — Paginierte Log-Tabelle mit Filter und aufklappbaren Details',
        'Settings — Modulstatus, Feature Flags, SAP BTP, Index-Status',
      ],
    },
    {
      id: 'composer',
      title: 'Template Composer',
      paragraphs: [
        'Der Template Composer ist das Herzstück des Agents. Er nimmt einen natürlichsprachlichen Prompt entgegen und generiert ein strukturiertes PI Sheet Template.',
        'Der Prozess:',
      ],
      list: [
        '1. LLM interpretiert den Prompt (Prozessbereich, Verpackungstyp)',
        '2. Retrieval: pgvector-Suche + Keyword-Fallback + Prozessgraph-Kette',
        '3. Rule Engine: Pflichtschritte (Line Clearance, Material ID, IPC, Goods Movement)',
        '4. Graph-Ordering: Steps werden nach Prozesskette sortiert',
        '5. Ausgabe: Strukturiertes JSON mit Steps, Validation, Evidence',
      ],
    },
    {
      id: 'approval',
      title: 'Genehmigungsprozess',
      paragraphs: [
        'Jedes generierte Template durchläuft einen Review-Workflow:',
      ],
      code: 'DRAFT_REQUIRES_REVIEW ──submit──→ IN_REVIEW ──approve──→ APPROVED ──archive──→ ARCHIVED\n                                       │\n                                       └──reject──→ REJECTED ──revise──→ DRAFT_REQUIRES_REVIEW',
      list: [
        'Ablehnung erfordert einen Kommentar',
        'Jede Statusänderung wird im Audit Trail protokolliert',
        'Genehmigte Templates können als SAP XML exportiert werden',
      ],
    },
    {
      id: 'api',
      title: 'API-Endpunkte',
      paragraphs: ['Alle Endpunkte unter /api/v1/xstep-agent/ (Auth erforderlich, außer health):'],
      code: `GET  /health                    — Modulstatus + Features
POST /retrieve                  — Retrieval (query, processArea, topK)
POST /compose-template          — Template generieren (prompt)
POST /validate-template         — Template validieren
POST /export-xml                — SAP XML Export
POST /import-xml                — SAP XML Import
POST /proposals                 — Proposal erstellen
GET  /proposals                 — Proposals auflisten
GET  /proposals/:id             — Einzelnes Proposal
POST /proposals/:id/:action     — Status ändern (submit/approve/reject/archive)
GET  /proposals/:id/audit       — Audit Trail für Proposal`,
    },
    {
      id: 'retrieval',
      title: 'Retrieval-Logik',
      paragraphs: ['Die Retrieval-Schicht kombiniert mehrere Quellen:'],
      list: [
        'DB-first: pgvector Embedding-Suche auf XSteps und Knowledge Chunks',
        'Keyword-Fallback: ILIKE-Suche wenn keine Embeddings vorhanden',
        'Process Graph: Step-Kette für korrekte Reihenfolge',
        'PI Sheet Examples: Genehmigte PI Sheets als Referenz',
        'Mock-Daten: Fallback für Materials und Recipes',
        'Scoring: Ergebnisse werden nach Relevanz sortiert (Similarity + Keywords)',
      ],
    },
    {
      id: 'golden-rules',
      title: 'Golden Rules',
      paragraphs: ['Diese Regeln gelten für das gesamte XStep Agent Modul:'],
      list: [
        'Kein Schreiben in SAP (kein Write-Back)',
        'Keine autonome GMP-Genehmigung',
        'Feature Flag muss aktiv sein (XSTEP_AGENT_ENABLED=true)',
        'Isoliertes Modul — bestehender Code wird nicht verändert',
        'Strukturierte JSON-Ausgaben — kein Freitext',
        'Audit Trail für alle Aktionen',
        'Human Approval für alle Templates vor Export',
      ],
    },
  ],
};

const helpEn = {
  title: 'AI XStep Agent — Documentation',
  subtitle: 'Architecture, data flow, views, and API reference',
  toc: 'Contents',
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      paragraphs: [
        'The AI XStep Agent is an isolated module for AI-assisted PI Sheet template composition. It uses existing XStep data, SOP documents, and the process graph to generate structured template proposals.',
        'The module is protected by the feature flag XSTEP_AGENT_ENABLED and can be disabled without affecting the existing application.',
      ],
      list: [
        'No SAP write-back in MVP',
        'No autonomous GMP approval',
        'Structured JSON outputs only',
        'Full audit trail',
        'Human-in-the-loop approval workflow',
      ],
    },
    {
      id: 'architecture',
      title: 'Architecture',
      paragraphs: ['The system consists of 11 frontend views and an isolated backend module:'],
      code: agentArchitecture.en,
    },
    {
      id: 'dataflow',
      title: 'Data Flow',
      paragraphs: [
        'Data enters the system through three paths: SAP XML export, CSV/Excel import, and SOP document upload. All data is stored in PostgreSQL, indexed with pgvector embeddings, and linked in the knowledge graph.',
      ],
      code: dataFlow.en,
    },
    {
      id: 'import',
      title: 'Data Import',
      paragraphs: ['There are three import paths:'],
      list: [
        'XSteps (SAP XML / CSV / Excel): Admin → Repository → Upload. Required fields: xstep_id, name, category, process_type. German column names are auto-detected.',
        'SOP Documents (PDF / DOCX / TXT): Admin → Knowledge Base → Upload. Documents are automatically chunked and embedded.',
        'Process Graph: Automatically extracted from SOP uploads (GraphRAG). QA approves or rejects suggestions.',
      ],
    },
    {
      id: 'views',
      title: 'Views (11)',
      paragraphs: ['The Admin Board consists of:'],
      list: [
        'Dashboard — KPIs, system status, recent activity, quick actions',
        'Material Explorer — Materials and recipe assignments (mock data / SAP)',
        'Recipe Explorer — Master recipes with op/phase/XStep hierarchy',
        'XStep Browser — Search, filter, pagination, detail drawer',
        'SOP Browser — Document cards with chunks, category and process filters',
        'Template Composer — NL prompt → AI template, validation, evidence, XML export',
        'Review Board — Approval workflow: Submit → Review → Approve/Reject → Archive',
        'Retrieval Debugger — Explainability: scores, graph context, raw data',
        'Knowledge Graph — Process chain, nodes, edges, equipment, Mermaid',
        'Audit Trail — Paginated log table with filters and expandable details',
        'Settings — Module status, feature flags, SAP BTP, index status',
      ],
    },
    {
      id: 'composer',
      title: 'Template Composer',
      paragraphs: [
        'The Template Composer is the core of the agent. It takes a natural language prompt and generates a structured PI Sheet template.',
        'The process:',
      ],
      list: [
        '1. LLM interprets the prompt (process area, packaging type)',
        '2. Retrieval: pgvector search + keyword fallback + process graph chain',
        '3. Rule Engine: mandatory steps (line clearance, material ID, IPC, goods movement)',
        '4. Graph ordering: steps are sorted by process chain',
        '5. Output: structured JSON with steps, validation, evidence',
      ],
    },
    {
      id: 'approval',
      title: 'Approval Workflow',
      paragraphs: ['Every generated template goes through a review workflow:'],
      code: 'DRAFT_REQUIRES_REVIEW ──submit──→ IN_REVIEW ──approve──→ APPROVED ──archive──→ ARCHIVED\n                                       │\n                                       └──reject──→ REJECTED ──revise──→ DRAFT_REQUIRES_REVIEW',
      list: [
        'Rejection requires a comment',
        'Every status change is logged in the audit trail',
        'Approved templates can be exported as SAP XML',
      ],
    },
    {
      id: 'api',
      title: 'API Endpoints',
      paragraphs: ['All endpoints under /api/v1/xstep-agent/ (auth required, except health):'],
      code: `GET  /health                    — Module status + features
POST /retrieve                  — Retrieval (query, processArea, topK)
POST /compose-template          — Generate template (prompt)
POST /validate-template         — Validate template
POST /export-xml                — SAP XML export
POST /import-xml                — SAP XML import
POST /proposals                 — Create proposal
GET  /proposals                 — List proposals
GET  /proposals/:id             — Get single proposal
POST /proposals/:id/:action     — Transition status (submit/approve/reject/archive)
GET  /proposals/:id/audit       — Audit trail for proposal`,
    },
    {
      id: 'retrieval',
      title: 'Retrieval Logic',
      paragraphs: ['The retrieval layer combines multiple sources:'],
      list: [
        'DB-first: pgvector embedding search on XSteps and knowledge chunks',
        'Keyword fallback: ILIKE search when embeddings are unavailable',
        'Process Graph: step chain for correct ordering',
        'PI Sheet Examples: approved PI sheets as reference',
        'Mock data: fallback for materials and recipes',
        'Scoring: results are ranked by relevance (similarity + keywords)',
      ],
    },
    {
      id: 'golden-rules',
      title: 'Golden Rules',
      paragraphs: ['These rules apply to the entire XStep Agent module:'],
      list: [
        'No SAP write-back',
        'No autonomous GMP approval',
        'Feature flag must be active (XSTEP_AGENT_ENABLED=true)',
        'Isolated module — existing code is not modified',
        'Structured JSON outputs — no free text',
        'Audit trail for all actions',
        'Human approval required before export',
      ],
    },
  ],
};
