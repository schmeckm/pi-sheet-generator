# PI Sheet Generator — Pilot Application

## Project Overview

Build a full-stack Node.js pilot application: an **LLM-powered PI (Process Instruction) Sheet Generator** for pharmaceutical manufacturing. Users describe what they need in natural language (e.g., "I need a PI Sheet for Verpackung with Rückmeldungen and Warenbewegungen"), and the system generates a structured PI Sheet proposal based on XStep data from a configurable repository.

The application has **two areas**:
1. **Operator Chat UI** — natural language input → LLM generates PI Sheet → digital + print preview
2. **Admin Area** — upload/manage the XStep repository (CSV/JSON), configure prompts, manage users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API) + Vite + Pinia + Vue Router |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + pgvector extension |
| ORM | Sequelize v6 |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) |
| Embeddings | Anthropic Voyager or OpenAI text-embedding-3-small |
| Auth | JWT (jsonwebtoken) + bcrypt |
| File Upload | Multer |
| PDF Export | PDFKit |
| Styling | Tailwind CSS |
| Validation | Joi (backend), Vuelidate (frontend) |

---

## Project Structure

```
pi-sheet-generator/
├── client/                          # Vue 3 Frontend
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── router/
│   │   │   └── index.js             # Vue Router with auth guards
│   │   ├── stores/
│   │   │   ├── auth.js              # Pinia auth store
│   │   │   ├── chat.js              # Chat messages & PI sheet state
│   │   │   └── repository.js        # XStep repository state
│   │   ├── views/
│   │   │   ├── ChatView.vue         # Operator: chat + PI sheet preview
│   │   │   ├── LoginView.vue        # Login page
│   │   │   ├── AdminDashboard.vue   # Admin: overview & stats
│   │   │   ├── RepositoryView.vue   # Admin: XStep repository management
│   │   │   ├── UploadView.vue       # Admin: CSV/JSON upload + mapping
│   │   │   └── PromptConfigView.vue # Admin: system prompt editor
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatInput.vue
│   │   │   │   ├── ChatMessage.vue
│   │   │   │   └── QuickPrompts.vue
│   │   │   ├── pisheet/
│   │   │   │   ├── PISheetPreview.vue    # Digital view
│   │   │   │   ├── PISheetPrint.vue      # Offline/print view
│   │   │   │   ├── StepCard.vue          # Single XStep rendered
│   │   │   │   └── ParamTable.vue        # Parameter input table
│   │   │   ├── admin/
│   │   │   │   ├── XStepTable.vue        # CRUD table for XSteps
│   │   │   │   ├── UploadWizard.vue      # Multi-step upload flow
│   │   │   │   ├── ColumnMapper.vue      # Map CSV columns to XStep fields
│   │   │   │   └── PromptEditor.vue      # Edit system prompts
│   │   │   └── shared/
│   │   │       ├── AppHeader.vue
│   │   │       ├── Sidebar.vue
│   │   │       └── LoadingSpinner.vue
│   │   └── composables/
│   │       ├── useApi.js             # Axios wrapper with auth
│   │       └── useStreaming.js       # SSE streaming for LLM responses
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                          # Node.js Backend
│   ├── index.js                     # Express app entry
│   ├── config/
│   │   ├── database.js              # Sequelize + pgvector config
│   │   ├── auth.js                  # JWT config
│   │   └── anthropic.js             # Claude API config
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification middleware
│   │   ├── roles.js                 # Role-based access (admin vs operator)
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── index.js                 # Sequelize model loader
│   │   ├── User.js
│   │   ├── XStep.js                 # XStep with embedding vector column
│   │   ├── PISheet.js               # Generated PI sheets
│   │   ├── PISheetStep.js           # Steps within a PI sheet
│   │   ├── PromptConfig.js          # System prompt configurations
│   │   └── AuditLog.js              # Change tracking
│   ├── services/
│   │   ├── llm.service.js           # Claude API orchestration + RAG
│   │   ├── embedding.service.js     # Generate & store embeddings
│   │   ├── repository.service.js    # XStep CRUD + search
│   │   ├── template.service.js      # PI sheet generation + PDF
│   │   └── import.service.js        # CSV/JSON parsing + validation
│   ├── routes/
│   │   ├── auth.routes.js           # POST /login, /register
│   │   ├── chat.routes.js           # POST /chat, GET /chat/history
│   │   ├── repository.routes.js     # CRUD /xsteps, POST /xsteps/import
│   │   ├── template.routes.js       # GET /templates, GET /templates/:id/pdf
│   │   └── admin.routes.js          # GET /admin/stats, PUT /admin/prompts
│   ├── seeders/
│   │   └── seed-xsteps.js           # Sample XStep data for demo
│   └── package.json
│
├── docker-compose.yml               # PostgreSQL + pgvector + app
├── .env.example
└── README.md
```

---

## Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'operator', -- 'operator' | 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### XSteps (Repository)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE xsteps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xstep_id VARCHAR(50) UNIQUE NOT NULL,       -- e.g. "XS-VP-001"
  name VARCHAR(255) NOT NULL,                   -- e.g. "Materialbereitstellung"
  category VARCHAR(100) NOT NULL,               -- e.g. "Warenbewegung", "Rückmeldung", "Qualität"
  process_type VARCHAR(100) NOT NULL,           -- e.g. "Verpackung", "Abfüllung", "Granulation"
  description TEXT,
  instruction_template TEXT,                     -- Default operator instruction
  params JSONB DEFAULT '[]',                     -- [{name, type, unit, required, default_value}]
  sap_transaction VARCHAR(50),                   -- e.g. "MIGO", "CO11N"
  movement_type VARCHAR(10),                     -- SAP movement type e.g. "311", "261"
  gmp_relevant BOOLEAN DEFAULT false,
  signature_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  embedding vector(1536),                        -- pgvector embedding
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON xsteps USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### PI Sheets (Generated)
```sql
CREATE TABLE pi_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  process_type VARCHAR(100),
  description TEXT,
  user_prompt TEXT,                               -- Original user request
  llm_response JSONB,                             -- Raw LLM output
  status VARCHAR(50) DEFAULT 'draft',             -- 'draft' | 'review' | 'approved'
  notes JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pi_sheet_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_sheet_id UUID REFERENCES pi_sheets(id) ON DELETE CASCADE,
  step_nr INTEGER NOT NULL,
  xstep_id VARCHAR(50),                           -- Reference to xsteps.xstep_id (NULL if AI suggestion)
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  instruction TEXT,
  params JSONB DEFAULT '[]',
  is_suggestion BOOLEAN DEFAULT false,             -- true = AI-generated, not from repo
  sort_order INTEGER DEFAULT 0
);
```

### Prompt Configurations
```sql
CREATE TABLE prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,              -- e.g. "default", "verpackung_specific"
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Audit Log
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,                   -- 'xstep_created', 'pi_sheet_generated', etc.
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Core Backend Logic

### LLM Service (services/llm.service.js)

The RAG pipeline works as follows:

1. **Receive user prompt** (e.g., "PI Sheet für Verpackung mit Rückmeldungen und Warenbewegungen")
2. **Generate embedding** from the user prompt
3. **Vector search** — find top 15 most similar XSteps via pgvector cosine similarity
4. **Compose LLM prompt** — system prompt + relevant XSteps as context + user prompt
5. **Call Claude API** with streaming (SSE to frontend)
6. **Parse structured JSON response** into PI Sheet + Steps
7. **Store** the generated PI Sheet in the database

```javascript
// Pseudocode for the core generate function
async function generatePISheet(userPrompt, userId) {
  // 1. Embed the user prompt
  const promptEmbedding = await embeddingService.embed(userPrompt);
  
  // 2. Find relevant XSteps via vector similarity
  const relevantXSteps = await repositoryService.searchSimilar(promptEmbedding, { limit: 15 });
  
  // 3. Get active system prompt
  const config = await PromptConfig.findOne({ where: { is_active: true } });
  
  // 4. Build messages for Claude
  const messages = [
    {
      role: "user",
      content: `Verfügbare XSteps aus dem Repository:\n${JSON.stringify(relevantXSteps)}\n\nUser-Anfrage: ${userPrompt}`
    }
  ];
  
  // 5. Call Claude API (streaming)
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: config.system_prompt,
    messages
  });
  
  // 6. Parse and store result
  // Return structured PI Sheet JSON
}
```

### System Prompt (Default)

The default system prompt for Claude should instruct it to:
- Act as a SAP Manufacturing / PI Sheet expert in pharma
- Accept the list of available XSteps and the user's natural language request
- Select appropriate XSteps, order them in logical process sequence
- Suggest additional steps not in the repository (marked as `is_suggestion: true`)
- Always include GMP-relevant steps (line clearance, IPC, documentation)
- Return ONLY valid JSON (no markdown) with this structure:

```json
{
  "title": "PI Sheet title",
  "process_type": "Verpackung|Abfüllung|etc.",
  "description": "Short description",
  "steps": [
    {
      "step_nr": 1,
      "xstep_id": "XS-VP-001 or NEW-001",
      "name": "Step name",
      "category": "Warenbewegung|Rückmeldung|Qualität|Prozess|Dokumentation",
      "instruction": "Detailed operator instruction in German",
      "params": [
        {"name": "Parameter name", "type": "input|display|checkbox", "unit": "unit or empty", "required": true}
      ],
      "is_suggestion": false
    }
  ],
  "notes": ["Note 1"],
  "warnings": ["GMP warning 1"]
}
```

Language: German. All operator instructions in German.

### Import Service (services/import.service.js)

Handles CSV and JSON uploads from the admin area:
- Parse uploaded file (CSV via `csv-parser`, JSON via native)
- Validate required fields: `xstep_id`, `name`, `category`, `process_type`
- Allow column mapping (admin maps CSV columns to XStep fields in the UI)
- Generate embeddings for each imported XStep (batch processing)
- Upsert into database (update if `xstep_id` exists, create if new)
- Return import report: created, updated, skipped, errors

### Embedding Service (services/embedding.service.js)

- Create a text representation of each XStep for embedding:
  `"{name} - {category} - {process_type} - {description} - Params: {param_names}"`
- Call embedding API to generate 1536-dim vector
- Store in the `embedding` column via pgvector
- For user prompts: embed the prompt text and use for cosine similarity search

---

## Frontend Specifications

### Operator Chat View (ChatView.vue)

Split layout:
- **Left panel (60%)**: Chat interface
  - Message list (user messages right-aligned, assistant left-aligned)
  - Input bar at bottom with send button
  - Quick prompt suggestions for first-time users
  - Loading indicator during LLM generation ("Analysiere XSteps...")
  - SSE streaming of the response
  
- **Right panel (40%)**: PI Sheet Preview
  - Toggle between "Digital-Ansicht" and "Offline/Druck-Ansicht"
  - **Digital view**: Color-coded step cards by category, parameter input fields, KI-VORSCHLAG badges
  - **Print view**: Black & white, signature fields, empty input lines, document header with Dok-Nr/Version/Datum
  - PDF download button
  - "Übernehmen" button to save as template

Category color coding:
- Warenbewegung: Green (#4CAF50)
- Rückmeldung: Blue (#2196F3)
- Prozess: Orange (#FF9800)
- Qualität: Pink (#E91E63)
- Dokumentation: Purple (#9C27B0)

### Admin Dashboard (AdminDashboard.vue)

- Total XSteps count, by process type, by category
- Recent PI Sheets generated (list)
- System health / API status

### Repository Management (RepositoryView.vue)

- Searchable/filterable table of all XSteps
- Inline editing of XStep fields
- Delete with confirmation
- Filter by: process_type, category, gmp_relevant, is_active
- Bulk actions: activate/deactivate, delete

### Upload Wizard (UploadView.vue)

Multi-step flow:
1. **Upload**: Drag & drop CSV or JSON file
2. **Preview**: Show first 5 rows, detect columns
3. **Map**: Admin maps CSV columns → XStep fields (dropdown per column)
4. **Validate**: Show validation results, highlight errors
5. **Import**: Execute import, show results (created/updated/errors)

### Prompt Configuration (PromptConfigView.vue)

- Textarea with the current system prompt
- Save / Reset to default
- Version history of prompt changes
- "Test" button: enter a sample user prompt and see what Claude would return

---

## API Endpoints

### Auth
```
POST   /api/auth/login          { email, password } → { token, user }
POST   /api/auth/register       { email, password, name } → { token, user }  (admin only)
GET    /api/auth/me              → { user }
```

### Chat
```
POST   /api/chat/generate        { prompt } → SSE stream → { piSheet }
GET    /api/chat/history          → [{ id, prompt, title, created_at }]
GET    /api/chat/:id              → { piSheet with steps }
```

### Repository (Admin)
```
GET    /api/xsteps                ?process_type=&category=&search= → [xsteps]
GET    /api/xsteps/:id            → { xstep }
POST   /api/xsteps                { xstep } → { xstep }
PUT    /api/xsteps/:id            { xstep } → { xstep }
DELETE /api/xsteps/:id            → { success }
POST   /api/xsteps/import         multipart/form-data { file, mapping } → { report }
POST   /api/xsteps/bulk-action    { action, ids } → { result }
```

### Templates
```
GET    /api/templates              → [piSheets]
GET    /api/templates/:id          → { piSheet with steps }
GET    /api/templates/:id/pdf      → PDF binary
PUT    /api/templates/:id/status   { status } → { piSheet }
```

### Admin
```
GET    /api/admin/stats            → { xstepCount, templateCount, ... }
GET    /api/admin/prompts          → [promptConfigs]
PUT    /api/admin/prompts/:id      { system_prompt } → { promptConfig }
GET    /api/admin/audit-log        ?limit=&offset= → [auditLogs]
```

---

## Seed Data

Include sample XSteps for demo/testing covering these process types:

**Verpackung (Packaging)**:
- Linienclearance (Prozess, GMP)
- Materialbereitstellung (Warenbewegung)
- Wareneingang buchen 311 (Warenbewegung)
- Rückmeldung Verpackung (Rückmeldung)
- Warenausgang buchen 261 (Warenbewegung)
- Etikettierung (Prozess)
- IPC Gewichtskontrolle (Qualität, GMP)
- Chargenprotokoll abschließen (Dokumentation, GMP)

**Abfüllung (Filling)**:
- Tankbereitstellung (Warenbewegung)
- Abfüllparameter einstellen (Prozess)
- IPC Füllmengenkontrolle (Qualität, GMP)
- Rückmeldung Abfüllung (Rückmeldung)

**Granulation**:
- Rohstoff-Einwaage (Warenbewegung, GMP)
- Granulierparameter (Prozess)
- IPC Feuchtigkeitsprüfung (Qualität, GMP)
- Rückmeldung Granulation (Rückmeldung)

Each XStep should include realistic params, SAP transaction codes, and instruction templates in German.

---

## Docker Setup

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: pisheet
      POSTGRES_USER: pisheet
      POSTGRES_PASSWORD: pisheet_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  server:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://pisheet:pisheet_dev@db:5432/pisheet
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db

  client:
    build: ./client
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000/api

volumes:
  pgdata:
```

---

## Environment Variables (.env)

```
DATABASE_URL=postgres://pisheet:pisheet_dev@localhost:5432/pisheet
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
EMBEDDING_MODEL=text-embedding-3-small
PORT=3000
NODE_ENV=development
```

---

## Implementation Order

Build in this sequence:

1. **Database setup**: Docker compose, Sequelize models, migrations, seed data
2. **Auth**: User model, JWT middleware, login/register endpoints
3. **Repository Service**: XStep CRUD, import service (CSV/JSON parsing)
4. **Embedding Service**: Generate embeddings on XStep create/update, vector search
5. **LLM Service**: Claude API integration, RAG pipeline, streaming
6. **Chat API**: Generate endpoint with SSE streaming
7. **Template Service**: PI Sheet storage, PDF generation
8. **Frontend — Auth**: Login page, auth store, route guards
9. **Frontend — Chat**: Chat UI, streaming display, PI Sheet preview (digital + print)
10. **Frontend — Admin**: Dashboard, repository table, upload wizard, prompt editor
11. **Polish**: Error handling, loading states, responsive design, audit logging

---

## Key Requirements

- All UI text and operator instructions in **German**
- Admin area in **English** (international team)
- Full **GMP awareness**: the LLM must always suggest signature fields for quality steps, include line clearance, document audit trails
- **Streaming responses** via SSE — the user sees the PI Sheet building up
- PI Sheet print view must be **production-ready**: proper document header, signature lines, empty fields for handwritten entries, page numbers
- XStep repository must support **versioning** — when an XStep is updated, the old version is kept
- **Audit logging** on all admin actions and PI Sheet generations
- The system is a **decision support tool** — every generated PI Sheet is marked as "Entwurf" (draft) and requires human review
