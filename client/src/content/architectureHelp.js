import { mergeGovernanceSections } from './aiSkillGovernanceHelp';

const systemDiagram = {
  de: `┌──────────────────────────────────────────────────────────────────────┐
│  Vue 3 Client (Vite · Pinia · Vue Router · Tailwind · i18n DE/EN)     │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────────────┐ │
│  │ PI Assistent│ │ Digitalisieren│ │ Admin (Rolle admin)             │ │
│  │ Chat·Vorschau│ │ PDF/Scan     │ │ Dashboard·PI Sheets·Audit·Graph │ │
│  │ GMP-Workflow │ │              │ │ Repo·Upload·KB·Equipment·Settings│ │
│  └──────┬──────┘ └──────┬───────┘ └───────────────┬─────────────────┘ │
└─────────┼───────────────┼─────────────────────────┼───────────────────┘
          │ JWT · REST/SSE  │                         │
┌─────────▼───────────────▼─────────────────────────▼───────────────────┐
│  Express API (Node.js 20)                                              │
│  auth · xsteps · chat · templates · admin · knowledge · vision         │
│  equipment · weighing · settings · graph                               │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────────────────────┐  │
│  │ llm.service│ │ embedding +  │ │ import · template · audit        │  │
│  │ (Claude)   │ │ knowledge RAG│ │ equipment gateway · graph        │  │
│  └─────┬──────┘ └──────┬───────┘ └────────────────┬─────────────────┘  │
└────────┼───────────────┼──────────────────────────┼────────────────────┘
         │               │                          │
         ▼               ▼                          ▼
   Anthropic Claude   OpenAI Embeddings      PostgreSQL + pgvector
   (Sonnet)           (optional RAG)         Users · XSteps · PI Sheets
                                              Knowledge · Equipment · Audit
         │                                        ▲
         └──────── SAP MCP (optional) ────────────┘
              Waagen · OPC-UA/UNS · Live-Equipment-Q&A`,
  en: `┌──────────────────────────────────────────────────────────────────────┐
│  Vue 3 Client (Vite · Pinia · Vue Router · Tailwind · i18n DE/EN)     │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────────────┐ │
│  │ PI Assistant│ │ Digitize     │ │ Admin (admin role)              │ │
│  │ Chat·Preview │ │ PDF/scan     │ │ Dashboard·PI sheets·Audit·Graph │ │
│  │ GMP workflow │ │              │ │ Repo·Upload·KB·Equipment·Settings│ │
│  └──────┬──────┘ └──────┬───────┘ └───────────────┬─────────────────┘ │
└─────────┼───────────────┼─────────────────────────┼───────────────────┘
          │ JWT · REST/SSE  │                         │
┌─────────▼───────────────▼─────────────────────────▼───────────────────┐
│  Express API (Node.js 20)                                              │
│  auth · xsteps · chat · templates · admin · knowledge · vision         │
│  equipment · weighing · settings · graph                                 │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────────────────────┐  │
│  │ llm.service│ │ embedding +  │ │ import · template · audit        │  │
│  │ (Claude)   │ │ knowledge RAG│ │ equipment gateway · graph        │  │
│  └─────┬──────┘ └──────┬───────┘ └────────────────┬─────────────────┘  │
└────────┼───────────────┼──────────────────────────┼────────────────────┘
         │               │                          │
         ▼               ▼                          ▼
   Anthropic Claude   OpenAI Embeddings      PostgreSQL + pgvector
   (Sonnet)           (optional RAG)         Users · XSteps · PI Sheets
                                              Knowledge · Equipment · Audit
         │                                        ▲
         └──────── SAP MCP (optional) ────────────┘
              Scales · OPC-UA/UNS · live equipment Q&A`,
};

export const architectureHelp = {
  de: {
    title: 'Hilfe & Architektur',
    subtitle:
      'Bedienung des PI Assistenten und technischer Systemüberblick — UI-Sprache über Profil/Shell (DE/EN); KI-Skill-Governance unten auf Deutsch und Englisch',
    toc: 'Inhalt',
    sections: [
      {
        id: 'overview',
        title: 'Überblick',
        paragraphs: [
          'Der PI Sheet Generator ist eine Full-Stack-Pilotanwendung für die pharmazeutische Fertigung. Operatoren beschreiben in natürlicher Sprache, welches Process Instruction (PI) Sheet benötigt wird; das System erzeugt einen strukturierten Entwurf aus dem XStep-Repository, optionaler Dokument-Wissensbasis (RAG) und optional Live-Equipment-Daten (Waagen, OPC-UA/UNS via SAP MCP).',
          'Zwei Hauptbereiche: PI Assistent (Chat, Vorschau, PDF) und Administration (Masterdaten, Freigabe, Prompts, Equipment). KI-generierte PI Sheets sind GxP-Entwürfe und erfordern menschliche Prüfung und Freigabe durch Produktion und QA.',
        ],
      },
      {
        id: 'chat-help',
        title: 'Hilfe: PI Assistent',
        paragraphs: [
          'Bei leerem Chat erscheinen Begrüßung und Quick-Prompts (typische PI-Sheet- und Equipment-Fragen). Nach der ersten Nachricht wechselt die Ansicht in den Dialog.',
        ],
        list: [
          {
            label: 'Neues Gespräch',
            text: 'Kopfzeile „Neues Gespräch“ oder im Verlauf „+ Neues Gespräch“. Leert nur die aktuelle Browser-Session; gespeicherte PI Sheets im Verlauf bleiben. Bei laufender Antwort erscheint ein Bestätigungsdialog.',
          },
          {
            label: 'Verlauf',
            text: 'Listet zuletzt erstellte PI Sheets aus der Datenbank (keine Chat-Threads). Ein Eintrag öffnet Sheet und Kontext in der Vorschau.',
          },
          {
            label: 'Vorschau & GMP',
            text: 'Schritte, Parameter, GMP-Stepper; Workflow-Aktionen: zur Prüfung einreichen, freigeben, archivieren (siehe Admin → PI Sheets).',
          },
          {
            label: 'Digitalisieren',
            text: 'Separater Menüpunkt: PDF/Bild hochladen → Vision extrahiert Schritte → Übernahme ins PI Sheet.',
          },
        ],
      },
      {
        id: 'chat-modes',
        title: 'Chat-Modi',
        tableCaption: 'Modus, Beispiel und Ergebnis',
        tableCol1: 'Modus',
        tableCol2: 'Beispiel',
        tableCol3: 'Ergebnis',
        table: [
          ['PI Sheet', 'z. B. „PI Sheet für Verpackung mit Bestätigungen …“', 'Strukturiertes PI Sheet in der rechten Vorschau'],
          ['Equipment Q&A', 'z. B. „Welche Waagen sind aktiv?“', 'Textantwort mit LLM-Tools (kein neues PI Sheet)'],
        ],
      },
      {
        id: 'diagram',
        title: 'Systemarchitektur',
        diagram: systemDiagram.de,
      },
      {
        id: 'areas',
        title: 'Anwendungsbereiche',
        list: [
          {
            label: 'PI Assistent (Chat)',
            text: 'Natürliche Sprache → RAG (XSteps + Dokument-Chunks) → Claude erzeugt PI-Sheet-JSON → digitale/Druck-Vorschau, Speichern, PDF-Export, GMP-Status.',
          },
          {
            label: 'Equipment Q&A',
            text: 'Fragen zu Waagen und Geräten; optional Live-Daten über equipment gateway und SAP MCP.',
          },
          {
            label: 'Digitalisieren',
            text: 'Upload PDF/Bild → POST /api/vision/analyze → Schritte ins PI Sheet übernehmen.',
          },
          {
            label: 'Administration',
            text: 'XStep-Repository, Multi-Format-Import, Wissensbasis, Equipment, Systemeinstellungen, Prompt Config, PI-Sheet-Freigabe, Prozessgraph, Audit.',
          },
        ],
      },
      {
        id: 'frontend',
        title: 'Frontend',
        paragraphs: [
          'Vue 3 (Composition API), Vite, Pinia, Vue Router mit requiresAuth / requiresAdmin. SAP-Fiori-ähnliche Shell: SapShell, SapShellBar, SapSideNavigation.',
          'API: composables/useApi.js (Axios + JWT). Streaming: useStreaming.js (SSE) für generate-stream und qa-stream. Locale DE/EN in localStorage (pi-sheet-locale).',
        ],
        paths: [
          'client/src/views/ChatView.vue — Operator-Chat',
          'client/src/views/DigitalizeView.vue — Scan/PDF',
          'client/src/views/Admin*.vue — Dashboard, PI Sheets, Audit, Graph, …',
          'client/src/views/RepositoryView.vue, UploadView.vue, KnowledgeView.vue',
          'client/src/views/PromptConfigView.vue, EquipmentView.vue, SettingsView.vue',
          'client/src/components/pisheet/ — PI-Sheet-Darstellung & Workflow',
          'client/src/composables/useNewChat.js — Neues Gespräch',
          'client/src/stores/auth.js, chat.js, repository.js',
        ],
      },
      {
        id: 'backend',
        title: 'Backend',
        paragraphs: [
          'Express mit Helmet, CORS, Rate-Limiting (Login, Chat), zentraler Fehlerbehandlung. Sequelize auf PostgreSQL mit pgvector. Viele Laufzeit-Optionen in system_settings (Admin → Einstellungen), nicht nur in .env.',
        ],
        paths: [
          'server/index.js — Routen-Mounting, Equipment-WebSocket',
          'server/services/llm.service.js — Claude, RAG, requestMode pi_sheet | qa',
          'server/services/embedding.service.js — XStep-Vektorsuche',
          'server/services/knowledge.service.js — Dokument-Chunking & RAG',
          'server/services/import.service.js — CSV/Excel/JSON/XML/ZIP-Import',
          'server/services/template.service.js — PI Sheets, PDF, GMP-Workflow',
          'server/services/equipment/gateway.service.js — MCP/OPC-UA-Anbindung',
          'server/routes/settings.routes.js — system_settings, SAP-Test',
        ],
      },
      {
        id: 'database',
        title: 'Datenbank',
        paragraphs: [
          'PostgreSQL + pgvector. Zentrale Entitäten: User, XStep (+ Embedding), PISheet + PISheetStep, PromptConfig (+ Versionen), AuditLog, KnowledgeDocument + DocumentChunk, EquipmentConfig, SystemSetting, Prozessgraph-Kanten.',
        ],
        list: [
          { label: 'XSteps', text: 'Fertigungsschritt-Vorlagen: Kategorie, Prozesstyp, Parameter, SAP-Transaktion, GMP-Flags.' },
          { label: 'PI Sheets', text: 'Status-Workflow: Entwurf → in Prüfung → freigegeben → archiviert.' },
          { label: 'Wissensbasis', text: 'PDF/DOCX/XLSX/TXT → Chunks mit Embeddings für Dokument-RAG.' },
          { label: 'Equipment', text: 'Geräteprofile, Verbindungstest, Namespace-Suche (OPC-UA/UNS/MQTT).' },
        ],
      },
      {
        id: 'flow',
        title: 'Datenfluss: PI-Sheet-Generierung',
        steps: [
          'Operator sendet Prompt (POST /api/chat/generate oder generate-stream).',
          'llm.service leitet Prozesstyp und requestMode (pi_sheet | qa) ab.',
          'embedding.service: ähnliche XSteps (Vektor, Keyword-Fallback).',
          'knowledge.service: relevante Dokument-Chunks (RAG).',
          'Bei Equipment-Fragen: Tools über equipment gateway / MCP.',
          'Aktiver PromptConfig + Kontext → Claude → JSON parsen, PISheet persistieren, Audit.',
          'Client: Vorschau; optional Workflow/PDF über /api/templates.',
        ],
      },
      {
        id: 'api',
        title: 'API-Endpunkte (Auswahl)',
        table: [
          ['POST /api/auth/login', 'JWT-Anmeldung'],
          ['CRUD /api/xsteps', 'XStep-Repository'],
          ['POST /api/xsteps/import/*', 'Import Preview/Validate/Confirm'],
          ['POST /api/chat/generate[-stream]', 'PI Sheet via LLM (+ SSE)'],
          ['POST /api/chat/qa-stream', 'Equipment Q&A (SSE)'],
          ['GET /api/chat/history', 'PI-Sheet-Verlauf'],
          ['GET/POST /api/templates/*', 'PI Sheets, PDF, submit/approve/archive'],
          ['GET /api/admin/stats', 'Dashboard'],
          ['CRUD /api/admin/prompts', 'System-Prompt, Versionen, Test'],
          ['GET /api/admin/audit-log', 'Audit-Log'],
          ['CRUD /api/knowledge', 'Wissensbasis'],
          ['CRUD /api/equipment', 'Geräte, Namespace-Suche, Connect/Test'],
          ['GET/POST /api/weighing', 'Waagen-Prozesse'],
          ['GET/PUT /api/settings', 'Systemeinstellungen, SAP-Test'],
          ['GET/POST /api/graph/*', 'Prozessgraph, Vorschläge'],
          ['POST /api/vision/analyze', 'PDF/Bild-Analyse'],
        ],
      },
      {
        id: 'admin-modules',
        title: 'Admin-Module',
        list: [
          { label: 'Dashboard', text: 'Kennzahlen: XSteps, PI Sheets, Benutzer, GMP-Steps, Audit-Aktivität.' },
          { label: 'PI Sheets (Freigabe)', text: 'Warteschlange GMP-Workflow: einreichen, freigeben, ablehnen, archivieren.' },
          { label: 'Audit-Log', text: 'Änderungsprotokoll aller relevanten Aktionen.' },
          { label: 'Prozessgraph', text: 'XStep-Beziehungen, KI-Vorschläge genehmigen/ablehnen.' },
          { label: 'Repository', text: 'XSteps anlegen, bearbeiten, filtern, Bulk-Aktionen.' },
          { label: 'Upload', text: 'Multi-Format-Import mit Spalten-Mapping (IMPORT-SPEC).' },
          { label: 'Wissensbasis', text: 'SOPs und Arbeitsanweisungen für erweitertes RAG.' },
          { label: 'Equipment', text: 'Geräte/Waagen, Verbindungstest, Namespace-Suche.' },
          { label: 'Einstellungen', text: 'system_settings: API-Keys, MCP-URL, Modell, SAP-Optionen.' },
          { label: 'Prompt Config', text: 'System-Prompt bearbeiten, Versionen, Diff, API-Test.' },
          { label: 'Hilfe & Architektur', text: 'Diese Seite inkl. KI-Skill-Governance & GMP-Validierung (folgt UI-Sprache DE/EN).' },
        ],
      },
      {
        id: 'env',
        title: 'Konfiguration & Ports',
        paragraphs: [
          'Infrastruktur in .env: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, optional OPENAI/EMBEDDING für Vektorsuche, SAP_MCP_*, CORS, PORT, VITE_API_URL.',
          'Prompt-Text, Modell und viele SAP-Optionen: Admin → Einstellungen (Datenbank), nicht in .env committen.',
        ],
        tableCaption: 'Standard-Ports (lokal / Docker)',
        tableCol1: 'Port',
        tableCol2: 'Dienst',
        table: [
          ['7000', 'API'],
          ['7001', 'SAP MCP (optional)'],
          ['7002', 'Vite Dev UI'],
          ['7003', 'PostgreSQL'],
          ['7004', 'Production UI (Docker/nginx)'],
        ],
      },
      {
        id: 'roadmap',
        title: 'MVP-Roadmap',
        list: [
          {
            label: 'MVP 1–4 (aktuell)',
            text: 'Chat, Repository, Import, Wissensbasis, Vision/Digitalisieren, Equipment Q&A, GMP-Lifecycle, Freigabe, Audit, Prozessgraph, Einstellungen.',
          },
          { label: 'MVP 2+', text: 'Erweiterte MCP-SAP-Integration, Multimodal (MVP2-SPEC).' },
          { label: 'MVP 3+', text: 'Simulation, erweiterter Approval, SAP-Rückschreibung, Shop-Floor, GxP Audit Trail.' },
        ],
      },
      {
        id: 'docs',
        title: 'Weitere Dokumentation',
        list: [
          { label: 'README.md', text: 'Quick Start, Architektur-Diagramm (EN).' },
          { label: 'docs/DOCUMENTATION.md', text: 'Vollständiges Handbuch (DE).' },
          { label: 'docs/DOCUMENTATION.en.md', text: 'Handbuch (EN).' },
          { label: 'docs/DEV.md', text: 'Entwickler-Referenz, Docker, Fehler.' },
          { label: 'docs/specs/', text: 'MVP4 (GMP), EQUIPMENT, IMPORT, MVP2, MVP5 (Graph).' },
        ],
      },
    ],
  },
  en: {
    title: 'Help & Architecture',
    subtitle:
      'PI Assistant usage and technical system overview — UI language via profile/shell (DE/EN); AI skill governance below in German and English',
    toc: 'Contents',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        paragraphs: [
          'The PI Sheet Generator is a full-stack pilot application for pharmaceutical manufacturing. Operators describe in natural language which Process Instruction (PI) sheet they need; the system produces a structured draft from the XStep repository, optional document knowledge base (RAG), and optional live equipment data (scales, OPC-UA/UNS via SAP MCP).',
          'Two main areas: PI Assistant (chat, preview, PDF) and Administration (master data, release workflow, prompts, equipment). AI-generated PI sheets are GxP drafts and require human review and approval by Production and QA.',
        ],
      },
      {
        id: 'chat-help',
        title: 'Help: PI Assistant',
        paragraphs: [
          'When the chat is empty, a welcome message and quick prompts appear (typical PI sheet and equipment questions). After the first message, the view switches to the conversation.',
        ],
        list: [
          {
            label: 'New conversation',
            text: 'Header “New conversation” or “+ New conversation” in history. Clears only the current browser session; saved PI sheets in history remain. A confirmation dialog appears if a response is in progress.',
          },
          {
            label: 'History',
            text: 'Lists recently created PI sheets from the database (not chat threads). An entry opens the sheet and context in the preview.',
          },
          {
            label: 'Preview & GMP',
            text: 'Steps, parameters, GMP stepper; workflow actions: submit for review, approve, archive (see Admin → PI Sheets).',
          },
          {
            label: 'Digitize',
            text: 'Separate menu item: upload PDF/image → vision extracts steps → apply to PI sheet.',
          },
        ],
      },
      {
        id: 'chat-modes',
        title: 'Chat modes',
        tableCaption: 'Mode, example, and result',
        tableCol1: 'Mode',
        tableCol2: 'Example',
        tableCol3: 'Result',
        table: [
          ['PI Sheet', 'e.g. “Create a PI sheet for packaging with confirmations …”', 'Structured PI sheet in the right preview'],
          ['Equipment Q&A', 'e.g. “Which scales are active?”', 'Text answer with LLM tools (no new PI sheet)'],
        ],
      },
      {
        id: 'diagram',
        title: 'System architecture',
        diagram: systemDiagram.en,
      },
      {
        id: 'areas',
        title: 'Application areas',
        list: [
          {
            label: 'PI Assistant (Chat)',
            text: 'Natural language → RAG (XSteps + document chunks) → Claude builds PI sheet JSON → digital/print preview, save, PDF export, GMP status.',
          },
          {
            label: 'Equipment Q&A',
            text: 'Questions about scales and devices; optional live data via equipment gateway and SAP MCP.',
          },
          {
            label: 'Digitize',
            text: 'Upload PDF/image → POST /api/vision/analyze → apply steps to PI sheet.',
          },
          {
            label: 'Administration',
            text: 'XStep repository, multi-format import, knowledge base, equipment, system settings, prompt config, PI sheet release queue, process graph, audit.',
          },
        ],
      },
      {
        id: 'frontend',
        title: 'Frontend',
        paragraphs: [
          'Vue 3 (Composition API), Vite, Pinia, Vue Router with requiresAuth / requiresAdmin. SAP Fiori–style shell: SapShell, SapShellBar, SapSideNavigation.',
          'API: composables/useApi.js (Axios + JWT). Streaming: useStreaming.js (SSE) for generate-stream and qa-stream. Locale DE/EN in localStorage (pi-sheet-locale).',
        ],
        paths: [
          'client/src/views/ChatView.vue — operator chat',
          'client/src/views/DigitalizeView.vue — scan/PDF',
          'client/src/views/Admin*.vue — dashboard, PI sheets, audit, graph, …',
          'client/src/views/RepositoryView.vue, UploadView.vue, KnowledgeView.vue',
          'client/src/views/PromptConfigView.vue, EquipmentView.vue, SettingsView.vue',
          'client/src/components/pisheet/ — PI sheet rendering & workflow',
          'client/src/composables/useNewChat.js — new conversation',
          'client/src/stores/auth.js, chat.js, repository.js',
        ],
      },
      {
        id: 'backend',
        title: 'Backend',
        paragraphs: [
          'Express with Helmet, CORS, rate limiting (login, chat), central error handling. Sequelize on PostgreSQL with pgvector. Many runtime options in system_settings (Admin → Settings), not only in .env.',
        ],
        paths: [
          'server/index.js — route mounting, equipment WebSocket',
          'server/services/llm.service.js — Claude, RAG, requestMode pi_sheet | qa',
          'server/services/embedding.service.js — XStep vector search',
          'server/services/knowledge.service.js — document chunking & RAG',
          'server/services/import.service.js — CSV/Excel/JSON/XML/ZIP import',
          'server/services/template.service.js — PI sheets, PDF, GMP workflow',
          'server/services/equipment/gateway.service.js — MCP/OPC-UA integration',
          'server/routes/settings.routes.js — system_settings, SAP test',
        ],
      },
      {
        id: 'database',
        title: 'Database',
        paragraphs: [
          'PostgreSQL + pgvector. Core entities: User, XStep (+ embedding), PISheet + PISheetStep, PromptConfig (+ versions), AuditLog, KnowledgeDocument + DocumentChunk, EquipmentConfig, SystemSetting, process graph edges.',
        ],
        list: [
          { label: 'XSteps', text: 'Manufacturing step templates: category, process type, parameters, SAP transaction, GMP flags.' },
          { label: 'PI sheets', text: 'Status workflow: draft → in review → approved → archived.' },
          { label: 'Knowledge base', text: 'PDF/DOCX/XLSX/TXT → chunks with embeddings for document RAG.' },
          { label: 'Equipment', text: 'Device profiles, connection test, namespace search (OPC-UA/UNS/MQTT).' },
        ],
      },
      {
        id: 'flow',
        title: 'Data flow: PI sheet generation',
        steps: [
          'Operator sends prompt (POST /api/chat/generate or generate-stream).',
          'llm.service infers process type and requestMode (pi_sheet | qa).',
          'embedding.service: similar XSteps (vector, keyword fallback).',
          'knowledge.service: relevant document chunks (RAG).',
          'For equipment questions: tools via equipment gateway / MCP.',
          'Active PromptConfig + context → Claude → parse JSON, persist PISheet, audit.',
          'Client: preview; optional workflow/PDF via /api/templates.',
        ],
      },
      {
        id: 'api',
        title: 'API endpoints (selection)',
        table: [
          ['POST /api/auth/login', 'JWT sign-in'],
          ['CRUD /api/xsteps', 'XStep repository'],
          ['POST /api/xsteps/import/*', 'Import preview/validate/confirm'],
          ['POST /api/chat/generate[-stream]', 'PI sheet via LLM (+ SSE)'],
          ['POST /api/chat/qa-stream', 'Equipment Q&A (SSE)'],
          ['GET /api/chat/history', 'PI sheet history'],
          ['GET/POST /api/templates/*', 'PI sheets, PDF, submit/approve/archive'],
          ['GET /api/admin/stats', 'Dashboard'],
          ['CRUD /api/admin/prompts', 'System prompt, versions, test'],
          ['GET /api/admin/audit-log', 'Audit log'],
          ['CRUD /api/knowledge', 'Knowledge base'],
          ['CRUD /api/equipment', 'Devices, namespace search, connect/test'],
          ['GET/POST /api/weighing', 'Weighing processes'],
          ['GET/PUT /api/settings', 'System settings, SAP test'],
          ['GET/POST /api/graph/*', 'Process graph, suggestions'],
          ['POST /api/vision/analyze', 'PDF/image analysis'],
        ],
      },
      {
        id: 'admin-modules',
        title: 'Admin modules',
        list: [
          { label: 'Dashboard', text: 'Metrics: XSteps, PI sheets, users, GMP steps, audit activity.' },
          { label: 'PI Sheets (release)', text: 'GMP workflow queue: submit, approve, reject, archive.' },
          { label: 'Audit log', text: 'Change log for relevant actions.' },
          { label: 'Process graph', text: 'XStep relationships, approve/reject AI suggestions.' },
          { label: 'Repository', text: 'Create, edit, filter XSteps, bulk actions.' },
          { label: 'Upload', text: 'Multi-format import with column mapping (IMPORT-SPEC).' },
          { label: 'Knowledge base', text: 'SOPs and work instructions for extended RAG.' },
          { label: 'Equipment', text: 'Devices/scales, connection test, namespace search.' },
          { label: 'Settings', text: 'system_settings: API keys, MCP URL, model, SAP options.' },
          { label: 'Prompt config', text: 'Edit system prompt, versions, diff, API test.' },
          { label: 'Help & Architecture', text: 'This page including AI skill governance & GMP validation (follows UI language DE/EN).' },
        ],
      },
      {
        id: 'env',
        title: 'Configuration & ports',
        paragraphs: [
          'Infrastructure in .env: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, optional OPENAI/EMBEDDING for vector search, SAP_MCP_*, CORS, PORT, VITE_API_URL.',
          'Prompt text, model, and many SAP options: Admin → Settings (database); do not commit secrets in .env.',
        ],
        tableCaption: 'Default ports (local / Docker)',
        tableCol1: 'Port',
        tableCol2: 'Service',
        table: [
          ['7000', 'API'],
          ['7001', 'SAP MCP (optional)'],
          ['7002', 'Vite dev UI'],
          ['7003', 'PostgreSQL'],
          ['7004', 'Production UI (Docker/nginx)'],
        ],
      },
      {
        id: 'roadmap',
        title: 'MVP roadmap',
        list: [
          {
            label: 'MVP 1–4 (current)',
            text: 'Chat, repository, import, knowledge base, vision/digitize, equipment Q&A, GMP lifecycle, release, audit, process graph, settings.',
          },
          { label: 'MVP 2+', text: 'Extended MCP SAP integration, multimodal (MVP2-SPEC).' },
          { label: 'MVP 3+', text: 'Simulation, extended approval, SAP write-back, shop floor, GxP audit trail.' },
        ],
      },
      {
        id: 'docs',
        title: 'Further documentation',
        list: [
          { label: 'README.md', text: 'Quick start, architecture diagram (EN).' },
          { label: 'docs/DOCUMENTATION.md', text: 'Full guide (DE).' },
          { label: 'docs/DOCUMENTATION.en.md', text: 'Full guide (EN).' },
          { label: 'docs/DEV.md', text: 'Developer reference, Docker, troubleshooting.' },
          { label: 'docs/specs/', text: 'MVP4 (GMP), EQUIPMENT, IMPORT, MVP2, MVP5 (graph).' },
        ],
      },
    ],
  },
};

export function getArchitectureHelp(locale) {
  const key = locale === 'en' ? 'en' : 'de';
  const base = architectureHelp[key];
  return {
    ...base,
    sections: mergeGovernanceSections(base.sections),
  };
}
