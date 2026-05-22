# PI Sheet Generator — Cursor Prompt Playbook

> **Anleitung**: Arbeite diese Prompts der Reihe nach ab. Jeder Prompt geht in den Cursor Composer (Cmd+I / Ctrl+I). Teste nach jedem Schritt bevor du zum nächsten gehst. Die `.cursorrules` Datei muss im Projekt-Root liegen — Cursor liest sie automatisch als Kontext.

---

## Vorbereitung

```bash
mkdir pi-sheet-generator
cd pi-sheet-generator
# Lege die .cursorrules Datei hier rein (das große Prompt-Dokument)
# Öffne den Ordner in Cursor
```

---

## STEP 1 — Project Init + Database

```
Initialize the full project structure and database layer.

1. Create the complete folder structure as defined in .cursorrules:
   - /server with package.json including all dependencies: express, sequelize, pg, pg-hstore, pgvector, dotenv, cors, helmet, morgan, jsonwebtoken, bcryptjs, multer, csv-parser, pdfkit, @anthropic-ai/sdk, joi, uuid
   - /client — scaffold with: npm create vite@latest client -- --template vue, then add tailwindcss, @tailwindcss/vite, pinia, vue-router, axios
   - docker-compose.yml with pgvector/pgvector:pg16 as defined in .cursorrules
   - .env.example with all variables from .cursorrules
   - .env with same values (dev defaults, placeholder for ANTHROPIC_API_KEY)
   - .gitignore (node_modules, .env, dist, pgdata)

2. Set up Sequelize with PostgreSQL + pgvector extension:
   - server/config/database.js — Sequelize instance, on first sync run "CREATE EXTENSION IF NOT EXISTS vector"
   - All 6 models exactly as defined in .cursorrules schema:
     * server/models/User.js — id (UUID), email, password_hash, name, role (default 'operator')
     * server/models/XStep.js — all fields from schema INCLUDING embedding as vector(1536) via pgvector, params as JSONB
     * server/models/PISheet.js — with llm_response JSONB, status, notes/warnings as JSONB
     * server/models/PISheetStep.js — with is_suggestion boolean, params JSONB
     * server/models/PromptConfig.js — system_prompt TEXT, is_active boolean
     * server/models/AuditLog.js — action, entity_type, entity_id, details JSONB
   - server/models/index.js — model loader with associations:
     * User hasMany PISheet
     * PISheet belongsTo User (created_by)
     * PISheet hasMany PISheetStep (onDelete CASCADE)
     * PISheetStep belongsTo PISheet

3. Seed data — server/seeders/seed-xsteps.js:
   Create a runnable seed script (node server/seeders/seed-xsteps.js) that:
   - Creates admin user: admin@pisheet.local / admin123 / role: admin / name: "Admin"
   - Creates operator user: operator@pisheet.local / operator123 / role: operator / name: "Operator"
   - Creates the default PromptConfig with the full German system prompt from .cursorrules (the one that instructs Claude to return JSON with steps, params, notes, warnings)
   - Creates 16 XSteps across 3 process types with realistic German data:

   VERPACKUNG (8 XSteps):
   - XS-VP-001: Linienclearance | Prozess | GMP | "Bestätigen Sie die Linienclearance. Prüfen Sie, dass keine Restbestände des Vorgänger-Produkts vorhanden sind." | params: [{name:"Linie", type:"display"}, {name:"Produkt vorher", type:"input", required:true}, {name:"Reinigung bestätigt", type:"checkbox", required:true}, {name:"Visum Produktion", type:"input", required:true}, {name:"Visum QA", type:"input", required:true}] | signature_required:true
   - XS-VP-002: Materialbereitstellung | Warenbewegung | "Stellen Sie alle benötigten Verpackungsmaterialien gemäß Stückliste bereit." | params: [{name:"Material-Nr.", type:"input", required:true}, {name:"Charge", type:"input", required:true}, {name:"Menge", type:"input", unit:"Stk", required:true}, {name:"Lagerort", type:"input", required:true}] | sap_transaction:"MIGO"
   - XS-VP-003: Wareneingang buchen (311) | Warenbewegung | "Buchen Sie den Wareneingang der Materialien mit Bewegungsart 311." | params: [{name:"Bewegungsart", type:"display", default_value:"311"}, {name:"Werk", type:"display"}, {name:"Lagerort Ab", type:"input", required:true}, {name:"Lagerort Zu", type:"input", required:true}, {name:"Menge", type:"input", required:true}] | sap_transaction:"MIGO" | movement_type:"311"
   - XS-VP-004: Verpackungsprozess starten | Prozess | "Starten Sie den Verpackungsprozess gemäß Arbeitsanweisung. Dokumentieren Sie Maschinenparameter." | params: [{name:"Linie", type:"display"}, {name:"Geschwindigkeit", type:"input", unit:"Stk/min"}, {name:"Format", type:"input"}, {name:"Startzeit", type:"input", required:true}]
   - XS-VP-005: IPC Gewichtskontrolle | Qualität | GMP | "Führen Sie die In-Prozess-Kontrolle der Gewichte durch. Dokumentieren Sie Messwerte." | params: [{name:"Sollgewicht", type:"display", unit:"g"}, {name:"Toleranz ±", type:"display", unit:"g"}, {name:"Messwert 1", type:"input", unit:"g", required:true}, {name:"Messwert 2", type:"input", unit:"g", required:true}, {name:"Messwert 3", type:"input", unit:"g", required:true}, {name:"Ergebnis", type:"input", required:true}] | signature_required:true
   - XS-VP-006: Etikettierung | Prozess | "Führen Sie die Etikettierung gemäß Etikettiervorgabe durch. Prüfen Sie Lesbarkeit und Vollständigkeit." | params: [{name:"Etikett-Typ", type:"input"}, {name:"Druckformat", type:"input"}, {name:"Prüfvermerk", type:"checkbox", required:true}]
   - XS-VP-007: Rückmeldung Verpackung | Rückmeldung | "Melden Sie den Verpackungsauftrag im SAP zurück." | params: [{name:"Auftrag", type:"input", required:true}, {name:"Vorgang", type:"input", required:true}, {name:"Gutmenge", type:"input", unit:"Stk", required:true}, {name:"Ausschussmenge", type:"input", unit:"Stk"}, {name:"Mengeneinheit", type:"display", default_value:"Stk"}] | sap_transaction:"CO11N"
   - XS-VP-008: Warenausgang buchen (261) | Warenbewegung | "Buchen Sie den Warenausgang der verbrauchten Materialien mit Bewegungsart 261." | params: [{name:"Material", type:"input", required:true}, {name:"Menge", type:"input", required:true}, {name:"Bewegungsart", type:"display", default_value:"261"}, {name:"Kostenstelle", type:"input"}] | sap_transaction:"MIGO" | movement_type:"261"
   - XS-VP-009: Chargenprotokoll abschließen | Dokumentation | GMP | "Schließen Sie das Chargenprotokoll ab. Alle Unterschriften müssen vollständig sein." | params: [{name:"Charge", type:"input", required:true}, {name:"Freigabe Produktion", type:"checkbox", required:true}, {name:"Freigabe QA", type:"checkbox", required:true}, {name:"Bemerkungen", type:"input"}] | signature_required:true

   ABFÜLLUNG (5 XSteps):
   - XS-AF-001: Tankbereitstellung | Warenbewegung | params: Tank-Nr., Produkt, Charge, Volumen (L)
   - XS-AF-002: Abfüllparameter einstellen | Prozess | params: Füllmenge (ml), Geschwindigkeit (Stk/min), Temperatur (°C)
   - XS-AF-003: IPC Füllmengenkontrolle | Qualität | GMP | params: Sollfüllmenge, Toleranz, Messwert 1-3, Ergebnis | signature_required
   - XS-AF-004: Rückmeldung Abfüllung | Rückmeldung | params: Auftrag, Vorgang, Gutmenge, Ausschuss | sap_transaction: CO11N
   - XS-AF-005: CIP Reinigung dokumentieren | Dokumentation | GMP | params: CIP-Programm, Dauer, Temperatur, Freigabe | signature_required

   GRANULATION (4 XSteps):
   - XS-GR-001: Rohstoff-Einwaage | Warenbewegung | GMP | params: Material, Sollmenge (kg), Istmenge (kg), Waage-ID, Kalibrierung bestätigt | signature_required
   - XS-GR-002: Granulierparameter | Prozess | params: Drehzahl (rpm), Sprührate (g/min), Temperatur (°C), Dauer (min)
   - XS-GR-003: IPC Feuchtigkeitsprüfung | Qualität | GMP | params: Sollwert (%), Toleranz, Messwert, Ergebnis | signature_required
   - XS-GR-004: Rückmeldung Granulation | Rückmeldung | params: Auftrag, Vorgang, Ausbeute (kg) | sap_transaction: CO11N

   Set sort_order sequentially within each process_type. Leave embedding as NULL for now (Step 4 fills it).

4. Add npm scripts to server/package.json:
   - "dev": "node --watch index.js"
   - "db:sync": runs sequelize.sync({ alter: true }) + creates extension
   - "db:seed": runs the seed script
   - "db:reset": drops all tables, re-syncs, re-seeds
   - "start": "node index.js"

5. Create a minimal server/index.js that:
   - Loads env, inits Express with cors, helmet, morgan, json parsing
   - Connects to DB via sequelize.authenticate()
   - Logs "Server running on port 3000"
   - Does NOT add routes yet (Step 2)

Test plan:
- docker-compose up -d → PostgreSQL starts with pgvector
- cd server && npm install && npm run db:sync && npm run db:seed
- npm run dev → "Server running on port 3000"
- Check DB: 2 users, 17 XSteps, 1 PromptConfig exist
```

---

## STEP 2 — Authentication

```
Implement the authentication system.

1. server/config/auth.js — JWT config reading JWT_SECRET and JWT_EXPIRES_IN from env

2. server/middleware/auth.js — JWT verification middleware:
   - Reads "Authorization: Bearer <token>" header
   - Verifies token, attaches user object to req.user
   - Returns 401 if missing/invalid

3. server/middleware/roles.js — Role-based access middleware:
   - Factory function: roles('admin') or roles('admin', 'operator')
   - Returns 403 if user role not in allowed list

4. server/middleware/errorHandler.js — Global error handler:
   - Catches Sequelize validation errors → 400
   - Catches JWT errors → 401
   - Everything else → 500 with generic message in production

5. server/routes/auth.routes.js:
   - POST /api/auth/login — validate with Joi (email, password required), find user by email, compare bcrypt hash, return { token, user: { id, email, name, role } }
   - POST /api/auth/register — protected by auth + roles('admin') middleware, validate (email, password, name, role), hash password, create user, return { token, user }
   - GET /api/auth/me — protected by auth middleware, return current user from token

6. Wire up in server/index.js:
   - app.use('/api/auth', authRoutes)
   - app.use(errorHandler) at the end

Test plan:
- POST /api/auth/login with { email: "admin@pisheet.local", password: "admin123" } → returns token
- GET /api/auth/me with Bearer token → returns user object
- GET /api/auth/me without token → 401
- POST /api/auth/register without admin token → 401
- POST /api/auth/register with admin token → creates new user
```

---

## STEP 3 — Repository CRUD + Import

```
Implement the XStep repository management with CRUD and CSV/JSON import.

1. server/services/repository.service.js:
   - findAll(filters) — query XSteps with optional filters: process_type, category, gmp_relevant, is_active, search (ILIKE on name + description)
   - findById(id)
   - create(data) — validate, create XStep, log to audit
   - update(id, data) — validate, update XStep (increment version), log to audit
   - delete(id) — soft delete (set is_active = false), log to audit
   - bulkAction(action, ids) — activate/deactivate/delete multiple

2. server/services/import.service.js:
   - parseCSV(fileBuffer, mapping) — use csv-parser to parse, apply column mapping { csvColumn: xstepField }, return array of XStep objects
   - parseJSON(fileBuffer) — parse JSON array, validate structure
   - importXSteps(xsteps, userId) — for each: validate required fields (xstep_id, name, category, process_type), upsert (update if xstep_id exists, create if new), collect results
   - Return import report: { created: N, updated: N, skipped: N, errors: [{row, message}] }

3. server/routes/repository.routes.js (all protected by auth middleware, admin role for write operations):
   - GET    /api/xsteps          — list with query params: ?process_type=&category=&gmp_relevant=&is_active=&search=&page=1&limit=50
   - GET    /api/xsteps/:id      — single XStep
   - POST   /api/xsteps          — create (admin only)
   - PUT    /api/xsteps/:id      — update (admin only)
   - DELETE /api/xsteps/:id      — soft delete (admin only)
   - POST   /api/xsteps/import   — multipart file upload (admin only), accepts { file: CSV/JSON, mapping: JSON string of column mapping }
   - POST   /api/xsteps/bulk-action — { action: "activate"|"deactivate"|"delete", ids: [uuid] } (admin only)

4. Use Multer for file upload:
   - Memory storage (no disk write needed for CSV/JSON)
   - Max file size 10MB
   - Accept .csv, .json extensions

5. Joi validation schemas:
   - createXStep: xstep_id required, name required, category required (enum: Warenbewegung, Rückmeldung, Prozess, Qualität, Dokumentation), process_type required, params as array of objects
   - updateXStep: same but all optional
   - importMapping: object with string values

6. Wire up in server/index.js: app.use('/api/xsteps', repositoryRoutes)

Test plan:
- GET /api/xsteps → returns all 17 seeded XSteps
- GET /api/xsteps?process_type=Verpackung → returns 9 XSteps
- GET /api/xsteps?search=Rückmeldung → returns 3 XSteps
- POST /api/xsteps with valid data → creates new XStep
- PUT /api/xsteps/:id → updates, version increments
- POST /api/xsteps/import with a CSV file → returns import report
- Bulk deactivate 3 XSteps → all set to is_active: false
```

---

## STEP 4 — Embedding Service + Vector Search

```
Implement the embedding service for semantic XStep search.

1. server/services/embedding.service.js:
   - buildSearchText(xstep) — creates a text representation for embedding:
     "{name} - {category} - {process_type} - {description} - Parameter: {param names joined by comma} - SAP: {sap_transaction} - Bewegungsart: {movement_type}"
   - generateEmbedding(text) — calls the embedding API to get a 1536-dim vector
     For the pilot, use the Anthropic API with a simple approach: since Anthropic doesn't have a dedicated embedding endpoint, use an alternative:
     Option A: Use OpenAI's text-embedding-3-small (if OPENAI_API_KEY is set in env)
     Option B: Fallback — create a simple TF-IDF/keyword-based vector using a local approach
     Implement Option A as primary, Option B as fallback when no API key is available.
   - embedXStep(xstepId) — load XStep, build search text, generate embedding, save to DB
   - embedAllXSteps() — batch embed all XSteps that have NULL embeddings
   - searchSimilar(queryText, { limit = 15, processType = null }) — embed the query, then run pgvector cosine similarity search:
     ```sql
     SELECT *, 1 - (embedding <=> $queryVector) AS similarity
     FROM xsteps
     WHERE is_active = true
     AND ($processType IS NULL OR process_type = $processType)
     ORDER BY embedding <=> $queryVector
     LIMIT $limit
     ```

2. Update server/services/repository.service.js:
   - After create: call embedXStep(newXStep.id)
   - After update: call embedXStep(updatedXStep.id)
   - After import: call embedAllXSteps()

3. Add a CLI command / npm script:
   - "db:embed": runs embedAllXSteps() to backfill all existing XSteps

4. If no embedding API key is configured, implement a keyword-based fallback search:
   - searchByKeywords(queryText, { limit, processType }) — simple ILIKE search on name, category, description, params
   - The LLM service should use vector search when available, keyword search as fallback

5. Add OPENAI_API_KEY to .env.example (optional)

Test plan:
- npm run db:embed → all 17 XSteps get embeddings (or logs "no API key, skipping")
- Test searchSimilar("Verpackung Rückmeldung Warenbewegung") → returns relevant XSteps ranked by similarity
- Test keyword fallback when no embeddings exist
```

---

## STEP 5 — LLM Service + Chat API

```
Implement the core LLM service with Claude API integration and the chat endpoint with SSE streaming.

1. server/config/anthropic.js:
   - Initialize Anthropic client from @anthropic-ai/sdk with ANTHROPIC_API_KEY
   - Export configured client

2. server/services/llm.service.js — THE CORE:
   - generatePISheet(userPrompt, userId) — the full RAG pipeline:
     a) Call embeddingService.searchSimilar(userPrompt, { limit: 15 }) to find relevant XSteps
        - If vector search fails, fall back to keyword search
     b) Load active PromptConfig from database
     c) Format the XSteps as a clean JSON context string
     d) Build Claude API request:
        - model: "claude-sonnet-4-20250514"
        - max_tokens: 4000
        - system: the system prompt from PromptConfig
        - messages: [{ role: "user", content: "Verfügbare XSteps aus dem Repository:\n{xstepsJSON}\n\nUser-Anfrage: {userPrompt}" }]
     e) Call anthropic.messages.create() (non-streaming first for reliability)
     f) Parse the response — extract JSON from Claude's response text
        - Try JSON.parse directly
        - If fails, try to extract JSON from markdown code blocks
        - If fails, return error
     g) Validate the parsed PI Sheet structure (must have title, steps array)
     h) Save to database: create PISheet + PISheetSteps
     i) Log to audit: 'pi_sheet_generated'
     j) Return the complete PI Sheet object with steps

   - generatePISheetStream(userPrompt, userId) — streaming version:
     a) Same retrieval + prompt building as above
     b) Use anthropic.messages.stream() instead
     c) Return the stream object for SSE forwarding

3. server/routes/chat.routes.js:
   - POST /api/chat/generate — protected by auth middleware
     - Accepts { prompt: string }
     - Validate: prompt is required, min 10 chars, max 2000 chars
     - Calls llm.service.generatePISheet(prompt, req.user.id)
     - Returns { piSheet } with full nested steps
     - On error: returns 500 with message

   - POST /api/chat/generate-stream — protected by auth middleware
     - Same input validation
     - Sets SSE headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
     - Streams Claude's response token by token via SSE
     - On stream end: parses complete response, saves PI Sheet, sends final "data: {piSheet}" event
     - Sends "data: [DONE]" at the end

   - GET /api/chat/history — protected by auth
     - Returns user's PI Sheets: [{ id, title, process_type, user_prompt, status, created_at }]
     - Ordered by created_at DESC, paginated

   - GET /api/chat/:id — protected by auth
     - Returns single PI Sheet with all steps included
     - Only if created_by matches current user (or user is admin)

4. Wire up: app.use('/api/chat', chatRoutes)

Test plan:
- POST /api/chat/generate with { prompt: "PI Sheet für Verpackung mit Rückmeldungen und Warenbewegungen" }
  → Returns a valid PI Sheet JSON with steps from the repository + possible AI suggestions
- POST /api/chat/generate-stream → SSE events stream in, final event contains the PI Sheet
- GET /api/chat/history → returns the generated sheet in history
- GET /api/chat/:id → returns full sheet with nested steps
```

---

## STEP 6 — Template Service + PDF Export

```
Implement the template service for PI Sheet management and PDF export.

1. server/services/template.service.js:
   - findAll(userId, filters) — list PI Sheets for user (admins see all), filter by status/process_type
   - findById(id, userId) — get PI Sheet with all PISheetSteps, check access
   - updateStatus(id, status, userId) — update status (draft → review → approved), audit log
   - generatePDF(id) — create a professional PDF using PDFKit:

     PDF Layout:
     - Page: A4, margins 50pt
     - Header: "Process Instruction Sheet" title, document metadata (Dok-Nr, Version, Datum, Seite)
     - Sub-header: PI Sheet title, process type, description
     - Meta fields row: Auftrag: _____, Charge: _____, Linie: _____

     For each step:
     - Step number in a circle/badge
     - Step name bold, XStep ID + category in smaller text
     - "KI-VORSCHLAG" badge if is_suggestion = true
     - Instruction text
     - Parameter table: Parameter | Wert/Eintrag | Pflicht columns
       - "Wert/Eintrag" column has empty underlines for handwriting
       - Pflicht shows ✕ for required, ○ for optional
     - Signature line for steps where the parent XStep has signature_required = true:
       "Durchgeführt: __________ Datum: __________ | Geprüft: __________ Datum: __________"

     Footer on each page:
     - "Erstellt: _____ Datum: _____ | Freigegeben: _____ Datum: _____ | QA-Review: _____ Datum: _____"
     - Page number

     Notes section: bullet list of notes
     Warnings section: framed box with "⚠ GMP-Hinweise" header

     Color coding in PDF:
     - GMP steps: light red background on header
     - KI-VORSCHLAG: yellow dashed border
     - Category indicators: small colored dot before category name

2. server/routes/template.routes.js (auth protected):
   - GET    /api/templates              — list user's PI Sheets
   - GET    /api/templates/:id          — single PI Sheet with steps
   - GET    /api/templates/:id/pdf      — generate and stream PDF (Content-Type: application/pdf)
   - PUT    /api/templates/:id/status   — update status { status: "review" | "approved" | "draft" }
   - DELETE /api/templates/:id          — delete (admin or owner, only if draft)

3. Wire up: app.use('/api/templates', templateRoutes)

Test plan:
- Generate a PI Sheet via /api/chat/generate first
- GET /api/templates → lists it
- GET /api/templates/:id/pdf → downloads a professional-looking PDF
- PUT /api/templates/:id/status with { status: "review" } → updates
```

---

## STEP 7 — Admin API

```
Implement admin-specific endpoints.

1. server/routes/admin.routes.js (auth + admin role required):
   - GET /api/admin/stats — returns:
     {
       xsteps: { total, byProcessType: { Verpackung: N, ... }, byCategory: { ... }, gmpRelevant: N },
       templates: { total, byStatus: { draft: N, review: N, approved: N }, thisWeek: N },
       users: { total, admins: N, operators: N },
       recentActivity: last 10 audit log entries
     }

   - GET  /api/admin/prompts     — list all PromptConfigs
   - PUT  /api/admin/prompts/:id — update system_prompt, audit log
   - POST /api/admin/prompts     — create new PromptConfig
   - POST /api/admin/prompts/:id/test — accepts { test_prompt: string }, runs it through the LLM service with this specific prompt config (not the active one), returns the result. This lets admins test prompt changes before activating.
   - PUT  /api/admin/prompts/:id/activate — set this config as active, deactivate others

   - GET /api/admin/audit-log — paginated audit log, filter by action/user/date

2. Wire up: app.use('/api/admin', adminRoutes)

Test plan:
- GET /api/admin/stats → returns complete dashboard data
- GET /api/admin/prompts → returns the seeded default prompt
- PUT /api/admin/prompts/:id with modified prompt → updates, audit logged
- POST /api/admin/prompts/:id/test with a test prompt → returns LLM response
```

---

## STEP 8 — Frontend: Auth + Layout Shell

```
Build the Vue 3 frontend foundation: auth flow, layout, routing.

1. client/src/router/index.js — Vue Router:
   - / → redirect to /chat
   - /login → LoginView (public)
   - /chat → ChatView (auth required, any role)
   - /admin → AdminDashboard (auth required, admin only)
   - /admin/repository → RepositoryView (admin)
   - /admin/upload → UploadView (admin)
   - /admin/prompts → PromptConfigView (admin)
   - Navigation guard: check auth store, redirect to /login if not authenticated
   - Admin guard: redirect to /chat if not admin

2. client/src/stores/auth.js — Pinia store:
   - State: user, token, isAuthenticated, isAdmin
   - Actions: login(email, password), logout(), loadFromStorage()
   - Persist token in localStorage
   - Axios interceptor: add Bearer token to all requests

3. client/src/composables/useApi.js:
   - Axios instance with baseURL from VITE_API_URL
   - Request interceptor: add auth header
   - Response interceptor: on 401 → logout and redirect to /login
   - Export get, post, put, del helper functions

4. client/src/views/LoginView.vue:
   - Clean, centered login form (email + password)
   - Tailwind styled, professional look
   - Error display for invalid credentials
   - On success: redirect to /chat (operator) or /admin (admin)
   - Show app title "PI Sheet Generator" with a subtle icon

5. client/src/components/shared/AppHeader.vue:
   - Top bar with "PI Sheet Generator" branding left
   - Navigation: Chat | Admin (admin only)
   - User name + role badge + logout button right
   - Tailwind: bg-gray-900, text-white, sticky top

6. client/src/components/shared/Sidebar.vue:
   - Admin sidebar with navigation:
     Dashboard | Repository | Upload | Prompt Config
   - Active state highlighting
   - Collapsible on mobile

7. client/src/App.vue:
   - AppHeader always visible (except login)
   - Router-view with sidebar for admin routes

8. Tailwind config:
   - Custom colors for categories: wabe-green, rueck-blue, process-orange, quality-pink, doku-purple
   - Font: Inter or system-ui

Test plan:
- npm run dev in /client → opens on localhost:5173
- /login page renders
- Login with admin@pisheet.local / admin123 → redirected to /admin
- Login with operator@pisheet.local / operator123 → redirected to /chat
- Header shows correct nav items per role
- Logout works, token cleared, redirect to /login
```

---

## STEP 9 — Frontend: Chat UI + PI Sheet Preview

```
Build the operator chat interface and PI Sheet preview — the core user experience.

1. client/src/stores/chat.js — Pinia store:
   - State: messages[], currentPISheet, isGenerating, history[]
   - Actions: sendMessage(prompt), loadHistory(), loadPISheet(id)
   - sendMessage flow:
     a) Add user message to messages[]
     b) Set isGenerating = true
     c) POST /api/chat/generate with { prompt }
     d) On success: add assistant message, set currentPISheet from response
     e) Set isGenerating = false

2. client/src/composables/useStreaming.js:
   - SSE helper for POST /api/chat/generate-stream
   - Accepts onChunk callback for progressive text display
   - Handles [DONE] event to extract final PI Sheet
   - Handles errors and reconnection

3. client/src/views/ChatView.vue — split layout:
   - Left panel (flex: 3): Chat area
   - Right panel (flex: 2): PI Sheet Preview
   - Panel toggle on mobile (tabs: Chat | Template)
   - Responsive: stack vertically on small screens

4. client/src/components/chat/ChatMessage.vue:
   - User messages: right-aligned, dark background, rounded corners
   - Assistant messages: left-aligned, light background
   - Assistant has small "PI Sheet Assistent" label
   - Whitespace pre-wrap for formatting

5. client/src/components/chat/ChatInput.vue:
   - Input field at bottom, full width with send button
   - Placeholder: "Beschreibe dein PI Sheet… z.B. 'Verpackung mit Rückmeldungen'"
   - Enter to send, disabled during generation
   - Character count indicator

6. client/src/components/chat/QuickPrompts.vue:
   - Show only when no messages yet (except welcome message)
   - 3-4 clickable suggestion cards:
     "PI Sheet für Verpackung mit Rückmeldungen und Warenbewegungen"
     "Abfüllung PI Sheet mit IPC und Chargenprotokoll"
     "Granulation mit Einwaage und Prozessparametern"
     "Verpackung komplett mit Linienclearance und Etikettierung"
   - Click fills input and auto-sends

7. client/src/components/pisheet/PISheetPreview.vue — THE KEY COMPONENT:
   - Toggle bar: "Digital-Ansicht" | "Offline/Druck-Ansicht" buttons
   - PDF download button
   - Empty state when no sheet generated yet

   DIGITAL VIEW:
   - Document header: "Process Instruction Sheet" + title + description
   - Metadata: Dok-Nr, Version 1.0 (Entwurf), Datum
   - Steps rendered as StepCard components
   - Color-coded by category (Warenbewegung=green, Rückmeldung=blue, Prozess=orange, Qualität=pink, Dokumentation=purple)
   - KI-VORSCHLAG badge (yellow, dashed border) for AI suggestions
   - Notes and warnings sections at bottom

   PRINT VIEW (Offline-Ansicht):
   - All black & white, no colors
   - Proper document header with empty fields: Auftrag: _____, Charge: _____, Linie: _____
   - Steps with numbered circles, category text
   - Parameter tables with empty lines for handwriting (border-bottom dotted)
   - Signature lines on GMP/Quality steps: "Durchgeführt: _____ Datum: _____ | Geprüft: _____ Datum: _____"
   - Footer: "Erstellt: _____ | Freigegeben: _____ | QA-Review: _____"
   - CSS @media print ready — looks good when browser-printed

8. client/src/components/pisheet/StepCard.vue:
   - Step number badge (circle with number, colored by category)
   - Step name (bold), XStep ID + category label
   - is_suggestion → yellow "KI-VORSCHLAG" tag
   - Instruction text
   - ParamTable component for parameters

9. client/src/components/pisheet/ParamTable.vue:
   - Table: Parameter | Eingabe | Pflicht
   - Input type rendering: "input" → text input or empty line, "display" → gray text, "checkbox" → checkbox
   - Required indicator: ● for required, ○ for optional
   - Print mode: all inputs become empty underlines

10. Loading state during generation:
    - Pulsing dots animation in chat
    - "Analysiere XSteps & generiere PI Sheet…" text
    - Skeleton loader on the preview panel

Test plan:
- Open /chat as operator
- See welcome message + quick prompts
- Click a quick prompt → message appears in chat, loading indicator shows
- After Claude responds → PI Sheet appears in right panel
- Toggle between Digital and Druck-Ansicht
- Print view shows black & white with empty fields
- PDF download button triggers /api/templates/:id/pdf download
- Chat history persists in the session
```

---

## STEP 10 — Frontend: Admin Area

```
Build the complete admin area: dashboard, repository management, upload wizard, prompt config.

1. client/src/stores/repository.js — Pinia store:
   - State: xsteps[], filters, pagination, importReport
   - Actions: loadXSteps(filters), createXStep(data), updateXStep(id, data), deleteXStep(id), importFile(file, mapping), bulkAction(action, ids)

2. client/src/views/AdminDashboard.vue:
   - Stats cards row: Total XSteps, PI Sheets Generated, Active Users, GMP Steps
   - XSteps by process type (small bar/list)
   - PI Sheets by status (draft/review/approved counts)
   - Recent activity list (last 10 audit log entries): timestamp, user, action, entity

3. client/src/views/RepositoryView.vue:
   - Top bar: Search input + Filter dropdowns (Process Type, Category, GMP, Active) + "Neuer XStep" button + "Import" button (links to /admin/upload)
   - XStepTable component: sortable, paginated table
   - Columns: XStep ID, Name, Category, Process Type, GMP, Active, Version, Actions (Edit/Delete)
   - Click row → expand inline edit form or open modal
   - Bulk select with checkboxes → bulk action bar (Activate, Deactivate, Delete)
   - Delete confirmation dialog
   - Edit XStep: modal or slide-over with form:
     All fields including params editor (add/remove params, each with name/type/unit/required)

4. client/src/components/admin/XStepTable.vue:
   - Responsive table with Tailwind styling
   - Category shown as colored badge
   - GMP shown as red badge "GMP"
   - is_active toggle switch
   - Sort by clicking column headers
   - Pagination: prev/next, page size selector (25/50/100)

5. client/src/views/UploadView.vue — Multi-step wizard:
   Step 1 - Upload:
   - Drag & drop zone for CSV or JSON files
   - File type auto-detection
   - Max 10MB indicator
   - "Oder Datei auswählen" button

   Step 2 - Preview:
   - Show first 5 rows of parsed data in a table
   - Detected columns listed
   - Row count: "48 Einträge erkannt"

   Step 3 - Column Mapping (ColumnMapper.vue):
   - Left: detected CSV columns
   - Right: dropdown with XStep fields (xstep_id, name, category, process_type, description, sap_transaction, movement_type, gmp_relevant)
   - Auto-map if column names match
   - Required fields highlighted
   - Preview of mapped data (first 3 rows transformed)

   Step 4 - Validation:
   - Run validation on all rows
   - Show: ✅ Valid: N rows, ⚠️ Warnings: N rows, ❌ Errors: N rows
   - Expandable error list with row number + message
   - "Trotzdem importieren" (skip errors) or "Zurück" to fix

   Step 5 - Import Result:
   - POST /api/xsteps/import
   - Progress indicator
   - Result: "Erstellt: 32, Aktualisiert: 8, Übersprungen: 3, Fehler: 5"
   - Link to repository view

6. client/src/views/PromptConfigView.vue:
   - List of prompt configurations (cards)
   - Active one highlighted with green border
   - Edit: large textarea with the system prompt (monospace font, line numbers if possible)
   - "Aktivieren" button on inactive configs
   - "Test" section: input field for test prompt + "Testen" button → shows Claude's raw JSON response in a code block
   - "Neue Konfiguration" button
   - Version history (list of previous edits with timestamps)

7. Styling across admin area:
   - Consistent Tailwind: bg-white rounded-lg shadow-sm border border-gray-200 for cards
   - Gray-50 page backgrounds
   - Consistent spacing: p-6 for cards, gap-6 for grids
   - Toast notifications for success/error (simple top-right stack)

Test plan:
- /admin → dashboard with real stats from API
- /admin/repository → table with all 17 XSteps, search works, filters work
- Edit an XStep → saves, version increments
- /admin/upload → upload a test CSV, map columns, import, see results
- /admin/prompts → see default prompt, edit, test with sample input
```

---

## STEP 11 — Polish + Production Readiness

```
Final polish: error handling, loading states, responsive design, and production readiness.

1. Error handling everywhere:
   - API calls wrapped in try/catch with user-friendly error messages (German for operator views, English for admin)
   - Network errors: "Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es erneut."
   - LLM errors: "Die KI konnte kein PI Sheet generieren. Bitte formulieren Sie Ihre Anfrage anders."
   - Toast notification system for success/error/warning
   - Form validation with inline error messages

2. Loading states:
   - Skeleton loaders for tables and cards
   - Spinner on buttons during API calls (disable button, show spinner)
   - Chat: typing indicator animation (three bouncing dots)
   - Page transitions: subtle fade

3. Responsive design:
   - Chat view: stack vertically on mobile, tab switcher for Chat/Preview
   - Admin tables: horizontal scroll on mobile, card view option
   - Sidebar: hamburger menu on mobile
   - All touch-friendly: min 44px tap targets

4. Empty states:
   - No XSteps found: illustration + "Keine XSteps gefunden" + action button
   - No PI Sheets: "Noch kein PI Sheet generiert" + link to chat
   - No search results: "Keine Ergebnisse für '{query}'"

5. Confirmation dialogs:
   - Delete XStep: "Sind Sie sicher? Diese Aktion kann nicht rückgängig gemacht werden."
   - Bulk delete: "X XSteps werden deaktiviert. Fortfahren?"
   - Status change to approved: "Das PI Sheet wird als freigegeben markiert."

6. Print optimization for PI Sheet:
   - @media print CSS that hides header, sidebar, chat
   - Only PI Sheet print view visible when printing
   - Page breaks between steps if needed
   - Proper A4 sizing

7. README.md:
   - Project description
   - Prerequisites (Docker, Node 18+)
   - Quick start:
     ```
     docker-compose up -d
     cd server && npm install && npm run db:sync && npm run db:seed
     cd ../client && npm install
     # Terminal 1: cd server && npm run dev
     # Terminal 2: cd client && npm run dev
     ```
   - Default credentials
   - Environment variables explained
   - Architecture overview
   - API documentation link

8. Security hardening:
   - Helmet.js already added
   - Rate limiting on /api/auth/login (max 5 attempts per minute)
   - Rate limiting on /api/chat/generate (max 20 per hour per user)
   - Input sanitization on all text inputs
   - SQL injection prevention (Sequelize parameterized queries)
   - XSS prevention (Vue auto-escapes, no v-html with user data)

Test plan — full end-to-end:
1. docker-compose up -d
2. npm run db:sync && npm run db:seed in server
3. Start server + client
4. Login as admin → see dashboard with stats
5. Go to repository → see all XSteps, filter, edit one
6. Go to upload → upload a test CSV, map, import → new XSteps appear
7. Go to prompt config → edit prompt, test it
8. Logout → Login as operator
9. Chat: "Ich brauche ein PI Sheet für Verpackung mit Rückmeldungen und Warenbewegungen"
10. PI Sheet appears → toggle digital/print → download PDF
11. Check history → previous sheet listed
12. Print the page → only PI Sheet prints cleanly
```

---

## Bonus: Test CSV for Upload

Save this as `test-xsteps.csv` to test the import:

```csv
xstep_id,name,category,process_type,description,sap_transaction,movement_type,gmp_relevant
XS-TAB-001,Tablettierung starten,Prozess,Tablettierung,Starten Sie die Tablettenpresse und dokumentieren Sie die Maschinenparameter.,,,false
XS-TAB-002,IPC Härteprüfung,Qualität,Tablettierung,Prüfen Sie die Tablettenhärte gemäß Prüfanweisung.,,,true
XS-TAB-003,IPC Zerfallstest,Qualität,Tablettierung,Führen Sie den Zerfallstest gemäß Arzneibuch durch.,,,true
XS-TAB-004,Rückmeldung Tablettierung,Rückmeldung,Tablettierung,Melden Sie den Tablettierauftrag zurück.,CO11N,,false
XS-TAB-005,Metalldetektor-Check,Qualität,Tablettierung,Prüfen Sie die Funktionsfähigkeit des Metalldetektors.,,,true
XS-COA-001,Coating-Lösung ansetzen,Prozess,Coating,Setzen Sie die Coating-Lösung gemäß Rezeptur an.,,,false
XS-COA-002,Coating-Parameter einstellen,Prozess,Coating,Stellen Sie Zulufttemperatur und Sprührate ein.,,,false
XS-COA-003,Rückmeldung Coating,Rückmeldung,Coating,Melden Sie den Coating-Auftrag im SAP zurück.,CO11N,,false
```

---

## Troubleshooting-Hinweise für Cursor

- Wenn Cursor den Kontext verliert: "Read .cursorrules and continue with step N"
- Wenn ein Import-Fehler kommt: "Fix the import error in [file], the issue is [error message]"
- Wenn das Styling nicht passt: "Improve the styling of [component] to match the design described in .cursorrules"
- Wenn die API nicht antwortet: "Check server/index.js — ensure all routes are mounted and CORS allows localhost:5173"
- Für Debugging: "Add console.log statements to trace the flow in [service] when [action]"
