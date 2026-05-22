export const architectureHelp = {
  de: {
    title: 'Architektur & Hilfe',
    subtitle: 'Systemüberblick für Administratoren — Komponenten, Datenflüsse und Module',
    toc: 'Inhalt',
    sections: [
      {
        id: 'overview',
        title: 'Überblick',
        paragraphs: [
          'Der PI Sheet Generator ist eine Full-Stack-Pilotanwendung für die pharmazeutische Fertigung. Operatoren beschreiben in natürlicher Sprache, welches Process Instruction (PI) Sheet benötigt wird; das System erzeugt einen strukturierten Entwurf auf Basis eines konfigurierbaren XStep-Repositorys und optionaler Unternehmensdokumente (RAG).',
          'Die Anwendung besteht aus zwei Hauptbereichen: dem Operator-Chat (PI Assistent) und dem Admin-Bereich (Repository, Import, Wissensbasis, Prompts). KI-generierte PI Sheets sind GxP-Entwürfe und erfordern eine menschliche Freigabe.',
        ],
      },
      {
        id: 'diagram',
        title: 'Systemarchitektur',
        diagram: `┌─────────────────────────────────────────────────────────────────┐
│  Vue 3 Client (Vite · Pinia · Vue Router · Tailwind · i18n)      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Chat /       │  │ Digitalisieren│  │ Admin (nur Rolle admin) │ │
│  │ PI-Vorschau  │  │ PDF/Scan      │  │ Dashboard · Repo · KB   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │ JWT + REST/SSE  │                      │
┌─────────▼─────────────────▼──────────────────────▼───────────────┐
│  Express API (Node.js)                                            │
│  auth · xsteps · chat · templates · admin · knowledge · vision   │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────────────────────┐│
│  │ llm.service│ │ embedding +  │ │ import · template · audit   ││
│  │ (Claude)   │ │ knowledge RAG│ │ knowledge · vision          ││
│  └─────┬──────┘ └──────┬───────┘ └──────────────┬──────────────┘│
└────────┼───────────────┼────────────────────────┼──────────────┘
         │               │                        │
         ▼               ▼                        ▼
   Anthropic API   OpenAI Embeddings      PostgreSQL + pgvector
   (Claude Sonnet)  (optional)            Users · XSteps · PI Sheets
                                         Knowledge · Chunks · Audit`,
      },
      {
        id: 'areas',
        title: 'Anwendungsbereiche',
        list: [
          { label: 'PI Assistent (Chat)', text: 'Natürliche Sprache → RAG über XSteps + Dokument-Chunks → Claude erzeugt PI Sheet JSON → digitale und Druck-Vorschau, Speichern als Template, PDF-Export.' },
          { label: 'Digitalisieren', text: 'Upload von PDF/Bildern → Vision-Service extrahiert Schritte → Übernahme ins PI Sheet (MVP 2.0).' },
          { label: 'Administration', text: 'XStep-Repository pflegen, CSV/JSON-Import, Dokument-Wissensbasis, System-Prompt konfigurieren, Dashboard-Statistiken und Audit-Log.' },
        ],
      },
      {
        id: 'frontend',
        title: 'Frontend',
        paragraphs: [
          'Vue 3 mit Composition API, Vite als Build-Tool, Pinia für Auth/Chat/Repository-State, Vue Router mit Guards (requiresAuth, requiresAdmin).',
          'SAP Fiori-ähnliche Shell (SapShell, SapShellBar, SapSideNavigation) für Chat und Admin. API-Zugriff über composables/useApi.js (Axios + JWT); Streaming über useStreaming.js (SSE).',
        ],
        paths: [
          'client/src/views/ChatView.vue — Operator-UI',
          'client/src/views/DigitalizeView.vue — Scan/PDF',
          'client/src/views/Admin*.vue, RepositoryView, UploadView, KnowledgeView, PromptConfigView',
          'client/src/components/pisheet/ — PI Sheet Darstellung',
          'client/src/stores/auth.js, chat.js, repository.js',
        ],
      },
      {
        id: 'backend',
        title: 'Backend',
        paragraphs: [
          'Express-Server mit Helmet, CORS, Rate-Limiting (Login, Chat), zentraler Fehlerbehandlung. Sequelize ORM auf PostgreSQL mit pgvector für semantische Suche.',
        ],
        paths: [
          'server/index.js — App-Einstieg, Route-Mounting',
          'server/services/llm.service.js — Claude-Orchestrierung, RAG-Kontext',
          'server/services/embedding.service.js — Vektor-Embeddings für XSteps',
          'server/services/knowledge.service.js — Dokument-Chunking & RAG',
          'server/services/import.service.js — CSV/JSON XStep-Import',
          'server/services/template.service.js — PI Sheets & PDF',
          'server/middleware/auth.js, roles.js — JWT & Admin-Guard',
        ],
      },
      {
        id: 'database',
        title: 'Datenbank',
        paragraphs: [
          'PostgreSQL mit pgvector. Zentrale Entitäten: User (admin/operator), XStep (mit optionalem Embedding-Vektor), PISheet + PISheetStep, PromptConfig, AuditLog, KnowledgeDocument + DocumentChunk.',
        ],
        list: [
          { label: 'XSteps', text: 'Fertigungsschritt-Vorlagen: Kategorie, Prozesstyp, Parameter, SAP-Transaktion, GMP-Flags.' },
          { label: 'PI Sheets', text: 'Generierte oder manuell gespeicherte Templates mit Status-Workflow.' },
          { label: 'Wissensbasis', text: 'Hochgeladene PDF/DOCX/XLSX/TXT → Chunks mit Embeddings für Dokument-RAG im Chat.' },
        ],
      },
      {
        id: 'flow',
        title: 'Datenfluss: PI Sheet Generierung',
        steps: [
          'Operator sendet Prompt im Chat (POST /api/chat/generate oder generate-stream).',
          'llm.service inferiert Prozesstyp aus dem Prompt.',
          'embedding.service sucht ähnliche XSteps (Vektorsuche, Fallback Keyword).',
          'knowledge.service liefert relevante Dokument-Chunks (RAG).',
          'Aktiver PromptConfig + System-Prompt + Kontext werden an Claude (claude-sonnet-4) gesendet.',
          'Antwort wird als JSON geparst; PISheet + PISheetSteps werden persistiert; Audit-Log geschrieben.',
          'Client zeigt Vorschau; optional Speichern/Status/PDF über /api/templates.',
        ],
      },
      {
        id: 'api',
        title: 'API-Endpunkte (Auswahl)',
        table: [
          ['POST /api/auth/login', 'JWT-Anmeldung'],
          ['CRUD /api/xsteps', 'XStep-Repository (Admin)'],
          ['POST /api/xsteps/import', 'CSV/JSON-Import'],
          ['POST /api/chat/generate[-stream]', 'PI Sheet via LLM (+ SSE)'],
          ['GET/PUT /api/templates', 'PI Sheet Templates & PDF'],
          ['GET /api/admin/stats', 'Dashboard-Statistiken'],
          ['PUT /api/admin/prompts', 'System-Prompt (Admin)'],
          ['CRUD /api/knowledge', 'Dokument-Wissensbasis'],
          ['POST /api/vision/analyze', 'PDF/Bild-Analyse'],
        ],
      },
      {
        id: 'admin-modules',
        title: 'Admin-Module',
        list: [
          { label: 'Dashboard', text: 'Kennzahlen: XSteps, PI Sheets, Benutzer, GMP-relevante Steps, letzte Audit-Aktivität.' },
          { label: 'Repository', text: 'XSteps anlegen, bearbeiten, filtern, Bulk-Aktionen.' },
          { label: 'Upload', text: 'CSV/JSON-Import mit Spalten-Mapping (siehe IMPORT-SPEC.md).' },
          { label: 'Wissensbasis', text: 'SOPs und Arbeitsanweisungen für erweitertes RAG.' },
          { label: 'Prompt Config', text: 'System-Prompt und Test-Generierung für Admins.' },
        ],
      },
      {
        id: 'env',
        title: 'Externe Dienste & Konfiguration',
        paragraphs: [
          'Wesentliche Umgebungsvariablen (.env): DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, optional EMBEDDING_API_KEY/OPENAI für Vektorsuche, PORT und VITE_API_URL.',
          'Docker Compose stellt PostgreSQL + pgvector bereit (Host-Port 7003). npm run dev: API 7000, Vite 7002.',
        ],
      },
      {
        id: 'roadmap',
        title: 'MVP-Roadmap',
        list: [
          { label: 'MVP 1.0 (aktuell)', text: 'Chat → PI Sheet, Admin XStep-Upload, Template-Vorschau, PDF-Export, RAG Wissensbasis, Digitalisieren.' },
          { label: 'MVP 2.0', text: 'MCP SAP Live-Anbindung, erweiterte Multi-Modal-Analyse (siehe MVP2-SPEC.md).' },
          { label: 'MVP 3.0', text: 'Simulation, Approval Workflow, SAP-Rückschreibung, Shop-Floor-App, GxP Audit Trail.' },
        ],
      },
      {
        id: 'docs',
        title: 'Weitere Dokumentation',
        list: [
          { label: 'README.md', text: 'Installation, Skripte, Zugangsdaten.' },
          { label: 'IMPORT-SPEC.md', text: 'CSV/JSON-Import-Format und Mapping.' },
          { label: 'MVP2-SPEC.md', text: 'MCP SAP, erweiterte RAG/Vision-Roadmap.' },
        ],
      },
    ],
  },
  en: {
    title: 'Architecture & Help',
    subtitle: 'System overview for administrators — components, data flows, and modules',
    toc: 'Contents',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        paragraphs: [
          'The PI Sheet Generator is a full-stack pilot application for pharmaceutical manufacturing. Operators describe in natural language which Process Instruction (PI) sheet they need; the system produces a structured draft from a configurable XStep repository and optional company documents (RAG).',
          'The application has two main areas: the operator chat (PI Assistant) and the admin area (repository, import, knowledge base, prompts). AI-generated PI sheets are GxP drafts and require human approval.',
        ],
      },
      {
        id: 'diagram',
        title: 'System architecture',
        diagram: `┌─────────────────────────────────────────────────────────────────┐
│  Vue 3 Client (Vite · Pinia · Vue Router · Tailwind · i18n)      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Chat /       │  │ Digitize     │  │ Admin (admin role only) │ │
│  │ PI preview   │  │ PDF/scan     │  │ Dashboard · repo · KB   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │ JWT + REST/SSE  │                      │
┌─────────▼─────────────────▼──────────────────────▼───────────────┐
│  Express API (Node.js)                                            │
│  auth · xsteps · chat · templates · admin · knowledge · vision   │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────────────────────┐│
│  │ llm.service│ │ embedding +  │ │ import · template · audit   ││
│  │ (Claude)   │ │ knowledge RAG│ │ knowledge · vision          ││
│  └─────┬──────┘ └──────┬───────┘ └──────────────┬──────────────┘│
└────────┼───────────────┼────────────────────────┼──────────────┘
         │               │                        │
         ▼               ▼                        ▼
   Anthropic API   OpenAI Embeddings      PostgreSQL + pgvector
   (Claude Sonnet)  (optional)            Users · XSteps · PI Sheets
                                         Knowledge · Chunks · Audit`,
      },
      {
        id: 'areas',
        title: 'Application areas',
        list: [
          { label: 'PI Assistant (Chat)', text: 'Natural language → RAG over XSteps + document chunks → Claude builds PI sheet JSON → digital and print preview, save as template, PDF export.' },
          { label: 'Digitize', text: 'Upload PDF/images → vision service extracts steps → apply to PI sheet (MVP 2.0).' },
          { label: 'Administration', text: 'Maintain XStep repository, CSV/JSON import, document knowledge base, configure system prompt, dashboard stats and audit log.' },
        ],
      },
      {
        id: 'frontend',
        title: 'Frontend',
        paragraphs: [
          'Vue 3 with Composition API, Vite, Pinia for auth/chat/repository state, Vue Router with guards (requiresAuth, requiresAdmin).',
          'SAP Fiori–style shell (SapShell, SapShellBar, SapSideNavigation) for chat and admin. API via composables/useApi.js (Axios + JWT); streaming via useStreaming.js (SSE).',
        ],
        paths: [
          'client/src/views/ChatView.vue — operator UI',
          'client/src/views/DigitalizeView.vue — scan/PDF',
          'client/src/views/Admin*.vue, RepositoryView, UploadView, KnowledgeView, PromptConfigView',
          'client/src/components/pisheet/ — PI sheet rendering',
          'client/src/stores/auth.js, chat.js, repository.js',
        ],
      },
      {
        id: 'backend',
        title: 'Backend',
        paragraphs: [
          'Express server with Helmet, CORS, rate limiting (login, chat), central error handling. Sequelize ORM on PostgreSQL with pgvector for semantic search.',
        ],
        paths: [
          'server/index.js — app entry, route mounting',
          'server/services/llm.service.js — Claude orchestration, RAG context',
          'server/services/embedding.service.js — vector embeddings for XSteps',
          'server/services/knowledge.service.js — document chunking & RAG',
          'server/services/import.service.js — CSV/JSON XStep import',
          'server/services/template.service.js — PI sheets & PDF',
          'server/middleware/auth.js, roles.js — JWT & admin guard',
        ],
      },
      {
        id: 'database',
        title: 'Database',
        paragraphs: [
          'PostgreSQL with pgvector. Core entities: User (admin/operator), XStep (optional embedding vector), PISheet + PISheetStep, PromptConfig, AuditLog, KnowledgeDocument + DocumentChunk.',
        ],
        list: [
          { label: 'XSteps', text: 'Manufacturing step templates: category, process type, parameters, SAP transaction, GMP flags.' },
          { label: 'PI Sheets', text: 'Generated or manually saved templates with status workflow.' },
          { label: 'Knowledge base', text: 'Uploaded PDF/DOCX/XLSX/TXT → chunks with embeddings for document RAG in chat.' },
        ],
      },
      {
        id: 'flow',
        title: 'Data flow: PI sheet generation',
        steps: [
          'Operator sends prompt in chat (POST /api/chat/generate or generate-stream).',
          'llm.service infers process type from the prompt.',
          'embedding.service finds similar XSteps (vector search, keyword fallback).',
          'knowledge.service returns relevant document chunks (RAG).',
          'Active PromptConfig + system prompt + context sent to Claude (claude-sonnet-4).',
          'Response parsed as JSON; PISheet + PISheetSteps persisted; audit log written.',
          'Client shows preview; optional save/status/PDF via /api/templates.',
        ],
      },
      {
        id: 'api',
        title: 'API endpoints (selection)',
        table: [
          ['POST /api/auth/login', 'JWT sign-in'],
          ['CRUD /api/xsteps', 'XStep repository (admin)'],
          ['POST /api/xsteps/import', 'CSV/JSON import'],
          ['POST /api/chat/generate[-stream]', 'PI sheet via LLM (+ SSE)'],
          ['GET/PUT /api/templates', 'PI sheet templates & PDF'],
          ['GET /api/admin/stats', 'Dashboard statistics'],
          ['PUT /api/admin/prompts', 'System prompt (admin)'],
          ['CRUD /api/knowledge', 'Document knowledge base'],
          ['POST /api/vision/analyze', 'PDF/image analysis'],
        ],
      },
      {
        id: 'admin-modules',
        title: 'Admin modules',
        list: [
          { label: 'Dashboard', text: 'Metrics: XSteps, PI sheets, users, GMP-relevant steps, recent audit activity.' },
          { label: 'Repository', text: 'Create, edit, filter XSteps, bulk actions.' },
          { label: 'Upload', text: 'CSV/JSON import with column mapping (see IMPORT-SPEC.md).' },
          { label: 'Knowledge base', text: 'SOPs and work instructions for extended RAG.' },
          { label: 'Prompt config', text: 'System prompt and test generation for admins.' },
        ],
      },
      {
        id: 'env',
        title: 'External services & configuration',
        paragraphs: [
          'Key environment variables (.env): DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, optional EMBEDDING_API_KEY/OPENAI for vector search, PORT and VITE_API_URL.',
          'Docker Compose provides PostgreSQL + pgvector (host port 7003). npm run dev: API 7000, Vite 7002.',
        ],
      },
      {
        id: 'roadmap',
        title: 'MVP roadmap',
        list: [
          { label: 'MVP 1.0 (current)', text: 'Chat → PI sheet, admin XStep upload, template preview, PDF export, RAG knowledge base, digitize.' },
          { label: 'MVP 2.0', text: 'MCP SAP live integration, extended multimodal analysis (see MVP2-SPEC.md).' },
          { label: 'MVP 3.0', text: 'Simulation, approval workflow, SAP write-back, shop-floor app, GxP audit trail.' },
        ],
      },
      {
        id: 'docs',
        title: 'Further documentation',
        list: [
          { label: 'README.md', text: 'Installation, scripts, credentials.' },
          { label: 'IMPORT-SPEC.md', text: 'CSV/JSON import format and mapping.' },
          { label: 'MVP2-SPEC.md', text: 'MCP SAP, extended RAG/vision roadmap.' },
        ],
      },
    ],
  },
};

export function getArchitectureHelp(locale) {
  return architectureHelp[locale === 'en' ? 'en' : 'de'];
}
