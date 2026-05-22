# PI Sheet Generator — MVP 2.0 Cursor Playbook

> **Voraussetzung**: MVP 1.0 ist komplett (alle 11 Steps). Dieses Playbook erweitert das bestehende Projekt.
> Spec: `docs/specs/MVP2-SPEC.md` · Playbook: `docs/playbooks/mvp2-playbook.md`
> Jeder Prompt geht in den Cursor Composer (Cmd+I).

---

## Kernprinzipien MVP 2.0

- **Offline-First**: Alles läuft ohne SAP-Verbindung. XSteps werden manuell hochgeladen.
- **SAP = Optional**: Über einen Admin-Schalter ein/ausschaltbar. System funktioniert 100% ohne SAP.
- **Bild-Upload = Kernfeature**: Papier-PI-Sheets digitalisieren ist der größte Mehrwert.
- **Wissensbasis = Bonus**: SOPs und Dokumente als zusätzlicher Kontext für bessere Vorschläge.

---

## RUNDE 1 — Vision Backend: Dokument-Erkennung

```
Read .cursorrules and MVP2-SPEC.md Teil 2. Add vision-based PI Sheet recognition to the existing project.

Important: This feature must work fully OFFLINE — no SAP connection needed. It uses the local XStep repository for matching.

1. Install new dependencies in /server:
   npm install sharp pdf-parse tesseract.js mammoth

2. Create server/services/vision.service.js with a 4-phase pipeline:

   PHASE 1 — PRE-PROCESSING (based on file type):
   - JPG/PNG: use sharp to resize to max 2048px, auto-rotate via EXIF, enhance contrast for dark photos. Output: optimized base64 PNG.
   - PDF: use pdf-parse to try text extraction. If text length > 100 chars → use text mode. If less (scanned PDF) → convert each page to PNG using sharp. Output: text string OR array of base64 images.
   - DOCX: use mammoth to extract text + structure (tables, lists, headings). Output: structured text.
   - XLSX: use xlsx (SheetJS, already installed) to extract all sheets as JSON. Output: structured text with table data.

   PHASE 2 — CLAUDE ANALYSIS:
   For images → call Claude API with vision:
     messages: [{
       role: "user",
       content: [
         { type: "image", source: { type: "base64", media_type: "image/png", data: imageBase64 } },
         { type: "text", text: VISION_ANALYSIS_PROMPT }
       ]
     }]
   For text → call Claude API with text:
     messages: [{ role: "user", content: extractedText + "\n\n" + TEXT_ANALYSIS_PROMPT }]
   For multi-page PDFs → send all pages as separate image blocks in one message.

   The VISION_ANALYSIS_PROMPT instructs Claude to return JSON with:
   {
     "document_type": "PI Sheet | Chargenprotokoll | Arbeitsanweisung | Unbekannt",
     "title": "recognized title",
     "process_type": "Verpackung | Abfüllung | etc.",
     "metadata": { "document_number", "version", "product", "line" },
     "steps": [{
       "step_nr": 1,
       "name": "Step name",
       "category_guess": "Warenbewegung | Rückmeldung | Prozess | Qualität | Dokumentation",
       "instruction": "Recognized instruction text",
       "params": [{ "name": "Param name", "value": "filled value or empty", "unit": "unit" }],
       "has_signature_field": true,
       "confidence": 0.95
     }],
     "notes": ["recognized notes"],
     "quality": { "image_quality": "good|medium|poor", "readability": "full|partial|low", "issues": [] }
   }
   Claude should recognize handwritten entries where possible, set null for unreadable values,
   and guess categories based on content (SAP terms like Bewegungsart, MIGO, CO11N are hints).
   Language: keep original language from the document (German or English).

   PHASE 3 — RAG MATCHING (against LOCAL repository only, no SAP):
   For each recognized step:
   a) Generate embedding of the step text (name + instruction + category_guess)
   b) Search XStep repository via pgvector cosine similarity
   c) Confidence > 0.85 → direct match → status: "matched", link to repository XStep
   d) Confidence 0.6-0.85 → possible match → status: "possible", user must confirm
   e) Confidence < 0.6 → no match → status: "new"
   If embedding service is not available (no API key), fall back to keyword matching (ILIKE on name + description).

   PHASE 4 — PI SHEET GENERATION:
   Combine recognized steps with repository matches.
   Call Claude again with:
   - The recognized steps
   - The matched repository XSteps (with their full params and instructions)
   - System prompt asking to: merge recognized + repository data, suggest missing GMP steps, output standard PI Sheet JSON
   Return full PI Sheet + match details per step.

3. Create API routes server/routes/vision.routes.js (auth required, any role):

   POST /api/vision/analyze
     - Multer: memory storage, max 20MB, accept .jpg .jpeg .png .pdf .docx .xlsx
     - Runs Phase 1 + 2 + 3 only (no PI Sheet generation yet)
     - Returns: { status: "analyzed", source: {type, filename, pages}, recognized: {...}, matches: [...], quality: {...} }

   POST /api/vision/generate
     - Same file upload OR accepts { analysis_id } to use previous analysis
     - Runs all 4 phases (or Phase 4 only if analysis_id provided)
     - Returns: { status: "generated", pi_sheet: {...}, matches: [...], confidence: 0.87 }

   POST /api/vision/confirm
     - Accepts: { pi_sheet_id, confirmed_steps: [...edited steps...] }
     - Saves final PI Sheet to database
     - Optional: { add_new_to_repository: true } → adds unmatched steps to XStep repository
     - Returns: { pi_sheet: {...final version...} }

4. Wire up: app.use('/api/vision', visionRoutes) in server/index.js

5. Create test images in server/test-data/:
   - Create a simple HTML file that looks like a PI Sheet, screenshot it as test-pi-sheet.png
   - The test should have 5-6 steps with German text, parameters, signature lines

Test plan:
- POST /api/vision/analyze with a JPG → returns recognized steps + quality assessment
- POST /api/vision/generate with same JPG → returns full PI Sheet with match info
- POST /api/vision/confirm → saves to database
- Test with PDF (text-based) → text extraction works
- Test with DOCX → mammoth extraction works
```

---

## RUNDE 2 — Vision Frontend: Digitalisierungs-UI

```
Read .cursorrules and MVP2-SPEC.md Teil 2 Frontend. Build the digitalization interface.

1. Add route: /digitalize → DigitalizeView.vue (auth required, any role)
2. Add navigation in AppHeader.vue: "📷 Digitalisieren" tab between Chat and Admin

3. Create client/src/stores/vision.js — Pinia store:
   - State: file, analysisResult, generatedSheet, step (1-4), isAnalyzing, isGenerating
   - Actions: analyzeFile(file), generateSheet(analysisId), confirmSheet(piSheetId, edits)

4. Create client/src/views/DigitalizeView.vue — 4-step wizard with progress bar at top:

   STEP 1 — UPLOAD:
   - Large drag & drop zone (dashed border, camera icon centered)
   - Title: "PI Sheet digitalisieren"
   - Subtitle: "Laden Sie ein Foto, Scan oder Dokument eines bestehenden PI Sheets hoch"
   - Accepted formats shown as small icons: JPG, PNG, PDF, DOCX, XLSX
   - File size limit shown: "Max. 20 MB"
   - After file selected: show filename, size, format icon, small thumbnail preview
   - "Analysieren" primary button → uploads to POST /api/vision/analyze
   - Loading state: "Dokument wird analysiert..." with animated progress (Phase 1: Vorbereitung, Phase 2: KI-Analyse, Phase 3: Repository-Abgleich)

   STEP 2 — ANALYSE-ERGEBNIS:
   - Split layout: left panel (50%) = original document viewer, right panel (50%) = recognized structure
   
   Left panel:
   - For images: display the uploaded image with zoom capability (click to enlarge)
   - For PDFs: embedded PDF viewer or page-by-page image display
   - For DOCX/XLSX: show extracted text in a formatted panel
   
   Right panel:
   - Quality badge at top: 🟢 "Gute Qualität" | 🟡 "Mittlere Qualität" | 🔴 "Schlechte Qualität"
   - If issues: yellow warning box with quality.issues list
   - Recognized metadata card: Titel, Dokumenttyp, Prozesstyp, Produkt, Linie (editable inline)
   - "Erkannte Schritte" section — for each step:
     * Step number + recognized name (bold)
     * Category badge (colored by category_guess)
     * Confidence bar: green >85%, yellow 60-85%, red <60%, with percentage number
     * Recognized parameters as small tag list
     * Match indicator:
       - 🟢 "Erkannt als XS-VP-001 — Linienclearance" (linked to repository)
       - 🟡 "Möglicher Match: XS-VP-005 — IPC Gewichtskontrolle (72%)" 
       - 🔴 "Neu — nicht im Repository"
   
   Bottom: "PI Sheet generieren" primary button → calls POST /api/vision/generate

   STEP 3 — REVIEW + BEARBEITEN:
   - Reuse the existing PISheetPreview.vue component BUT with extra overlays:
   - Each step card has a colored left border indicating match status:
     * Green (3px solid #4CAF50): matched to repository >85%
     * Yellow (3px dashed #FF9800): possible match 60-85%
     * Red (3px dashed #E91E63): new step, not in repository
   
   - Per step, show action buttons below the step card:
     * 🟢 matched steps: "✓ Übernommen aus Repository" label, "Bearbeiten" link
     * 🟡 possible matches: dropdown "Repository-XStep zuweisen:" with searchable select of all XSteps, "Wie erkannt übernehmen" button, "Bearbeiten" link
     * 🔴 new steps: "Manuell zuordnen" dropdown (search repository), "Wie erkannt übernehmen" button, "Bearbeiten" link, "Entfernen" link

   - "Bearbeiten" opens inline editor: name, category (dropdown), instruction (textarea), params (add/remove/edit)
   
   - Bottom action bar:
     * "GMP-Schritte ergänzen" button → calls Claude to suggest missing GMP steps, adds them as yellow "KI-VORSCHLAG"
     * "Parameter aus Repository übernehmen" button → for all matched steps, replace recognized params with repository standard params

   STEP 4 — BESTÄTIGEN + SPEICHERN:
   - Final PI Sheet in the standard PISheetPreview with toggle Digital/Druck-Ansicht
   - Summary card: "8 Schritte erkannt, 6 aus Repository, 2 neu"
   - Checkbox: "☐ Neue Schritte zum Repository hinzufügen" (adds red-marked steps as new XSteps)
   - "Als Template speichern" primary button → POST /api/vision/confirm
   - "PDF herunterladen" secondary button
   - Success message: "PI Sheet gespeichert! Sie finden es unter Templates."

5. Responsive: on mobile, Step 2 stacks vertically (image on top, recognized steps below)

Test plan:
- Navigate to /digitalize
- Upload a test image → see analysis loading phases
- Step 2: see recognized steps with match indicators and quality badge
- Step 3: edit a step, reassign an XStep, remove a step, add GMP steps
- Step 4: save → appears in templates list and chat history
- Test with PDF, DOCX, XLSX uploads
```

---

## RUNDE 3 — Wissensbasis RAG: Dokumente als Kontext

```
Read .cursorrules and MVP2-SPEC.md Teil 3. Add a document knowledge base that enriches PI Sheet generation with context from SOPs, work instructions, and batch records.

This must work fully OFFLINE — documents are uploaded manually, no external connections needed.

1. New Sequelize models:

   server/models/KnowledgeDocument.js:
   - id: UUID, primary key
   - title: STRING(255), not null
   - filename: STRING(255), not null
   - file_type: STRING(50) — pdf, docx, xlsx, txt
   - file_size: INTEGER
   - category: STRING(100) — "SOP", "Arbeitsanweisung", "Chargenprotokoll", "Qualitätsrichtlinie", "Validierung", "Sonstiges"
   - process_type: STRING(100), nullable — links to process types like Verpackung, Abfüllung
   - status: STRING(50), default "processing" — "processing" | "ready" | "error"
   - error_message: TEXT, nullable
   - page_count: INTEGER
   - chunk_count: INTEGER
   - uploaded_by: UUID, references users
   - timestamps

   server/models/DocumentChunk.js:
   - id: UUID, primary key
   - document_id: UUID, references knowledge_documents, onDelete CASCADE
   - chunk_index: INTEGER, not null
   - content: TEXT, not null — the text chunk
   - page_number: INTEGER, nullable
   - section_heading: STRING(255), nullable — detected heading above this chunk
   - embedding: VECTOR(1536)
   - metadata: JSONB — { has_table: bool, has_list: bool, keywords: [] }
   - timestamps

   Associations: KnowledgeDocument hasMany DocumentChunk
   Add pgvector index on document_chunks.embedding

2. server/services/knowledge.service.js:

   upload(file, metadata, userId):
   - Save file to server/uploads/knowledge/ (create dir if needed)
   - Create KnowledgeDocument record with status "processing"
   - Call processDocument() asynchronously (don't block the response)
   - Return the document record

   processDocument(documentId):
   - Load document record, read file from disk
   - TEXT EXTRACTION based on file_type:
     * PDF: pdf-parse → text with page breaks. If <100 chars per page → OCR via tesseract.js
     * DOCX: mammoth → text with heading structure
     * XLSX: SheetJS → convert each sheet to readable text (header + rows)
     * TXT: read directly
   - Set page_count from extraction
   
   - CHUNKING:
     * Split text into chunks of ~500 tokens (~2000 chars) with 100 token overlap
     * Keep track of page numbers per chunk
     * Detect section headings (lines that are short + followed by longer text)
     * Special handling for tables: keep entire table as one chunk (don't split mid-row)
     * Store each chunk with metadata: { has_table, has_list, keywords: top5 }
   
   - EMBEDDING:
     * Generate embedding for each chunk via embeddingService
     * If no embedding API key: skip embeddings, keyword search will be fallback
   
   - Update document: status = "ready", chunk_count = N
   - On error: status = "error", error_message = error text

   searchChunks(queryText, { limit = 10, processType = null, category = null }):
   - If embeddings available: vector search via pgvector with optional filters
   - Fallback: full-text search on content with ILIKE
   - Return chunks with their parent document title and page number

   findAll(filters): list documents with optional filters
   deleteDocument(id): remove file + all chunks + document record

3. EXTEND server/services/llm.service.js — enhanced RAG pipeline:

   In generatePISheet(userPrompt, userId):
   - EXISTING: search relevant XSteps via embeddingService.searchSimilarXSteps()
   - NEW: also search relevant document chunks via knowledgeService.searchChunks()
   - Build extended context for Claude:
     {
       xsteps: [...matched XSteps...],
       knowledge_context: [
         { source: "SOP-VP-001 Verpackungsanweisung", page: 3, content: "relevant chunk text..." },
         { source: "QA-Richtlinie GMP-Kontrollen", page: 12, content: "relevant chunk text..." }
       ]
     }
   - Add to system prompt: "Dir stehen zusätzlich relevante Auszüge aus Unternehmensdokumenten zur Verfügung (SOPs, Arbeitsanweisungen, Qualitätsrichtlinien). Nutze diese als Referenz für korrekte Anweisungstexte, GMP-Anforderungen, Parameter-Grenzwerte und firmenspezifische Terminologie. Zitiere die Quelle wenn du daraus Informationen verwendest."

4. API routes server/routes/knowledge.routes.js (admin role required):
   - POST   /api/knowledge/upload — multipart file upload (PDF, DOCX, XLSX, TXT), max 50MB
     Body: file + { title, category, process_type }
     Returns: { document } with status "processing"
   - GET    /api/knowledge — list all documents, optional filters: ?category=&process_type=&status=
     Returns: [{ id, title, filename, file_type, category, process_type, status, page_count, chunk_count, created_at }]
   - GET    /api/knowledge/:id — single document with chunk_count and metadata
   - GET    /api/knowledge/:id/chunks — paginated list of chunks (for debugging/review)
   - DELETE /api/knowledge/:id — delete document + file + all chunks
   - GET    /api/knowledge/stats — { total_documents, total_chunks, total_size_mb, by_category: {...}, by_status: {...} }
   - POST   /api/knowledge/:id/reprocess — re-run processing (useful after fixing OCR issues)

5. Wire up: app.use('/api/knowledge', knowledgeRoutes)

6. Frontend — client/src/views/KnowledgeView.vue (admin area):
   - Add route /admin/knowledge, add "Wissensbasis" to admin sidebar navigation
   
   Top section: Stats cards row
   - Total Dokumente | Total Chunks | Gesamtgröße | Nach Kategorie (mini bar)
   
   Upload section:
   - Drag & drop zone: "SOP, Arbeitsanweisung oder Dokument hochladen"
   - After file selected: show form fields: Titel (auto-filled from filename), Kategorie (dropdown), Prozesstyp (dropdown, optional)
   - "Hochladen" button → POST /api/knowledge/upload
   - After upload: document appears in table with status "Wird verarbeitet..."
   
   Documents table:
   - Columns: Titel, Typ (file icon), Kategorie (badge), Prozesstyp, Seiten, Chunks, Status, Datum, Aktionen
   - Status display: 🔄 "Wird verarbeitet" (spinning) | ✅ "Bereit" (green) | ❌ "Fehler" (red, show error on hover)
   - Actions: "Erneut verarbeiten" (if error), "Löschen" (with confirmation)
   - Click row to expand: show first 3 chunks as preview, page count, processing details
   
   Auto-refresh: poll GET /api/knowledge every 5 seconds while any document has status "processing"

Test plan:
- Upload a PDF SOP → status changes from "processing" to "ready"
- Check /api/knowledge/stats → shows correct counts
- Go to Chat → ask "PI Sheet für Verpackung mit Rückmeldungen"
- The response should now reference content from the uploaded SOP (if relevant)
- Delete the document → chunks are also removed
```

---

## RUNDE 4 — SAP Integration (Optional, Admin-Schalter)

```
Read .cursorrules and MVP2-SPEC.md Teil 1. Add OPTIONAL SAP integration controlled by an admin toggle. The system must work 100% without SAP — this is an enhancement, not a requirement.

1. Admin Settings — Add to existing admin area:

   server/models/SystemSetting.js — new model:
   - id: UUID
   - key: STRING(100), unique — e.g. "sap_integration_enabled", "sap_mcp_url", "sap_connection_type"
   - value: TEXT — the setting value
   - description: TEXT
   - updated_by: UUID references users
   - timestamps

   Seed default settings:
   - sap_integration_enabled: "false"
   - sap_mcp_url: "http://localhost:3001/mcp"
   - sap_connection_type: "mock" (options: "mock", "rfc", "odata", "me_api")
   - sap_auto_sync: "false"
   - sap_sync_interval_minutes: "60"

2. server/services/settings.service.js:
   - get(key) → returns value
   - set(key, value, userId) → update + audit log
   - getAll() → returns all settings as object
   - isFeatureEnabled(key) → returns boolean

3. Admin Settings UI — client/src/views/SettingsView.vue:
   - New route /admin/settings, add "Einstellungen" to admin sidebar
   - Section "SAP Integration":
     * Toggle switch: "SAP-Anbindung aktivieren" (big, prominent, OFF by default)
     * When OFF: show info text "Das System arbeitet vollständig offline mit dem lokalen XStep-Repository."
     * When ON: reveal additional settings:
       - MCP Server URL: text input (default: http://localhost:3001/mcp)
       - Verbindungstyp: dropdown (Mock-Daten / SAP RFC / SAP OData / SAP ME API)
       - "Verbindung testen" button → calls test endpoint → shows ✅ or ❌
       - Auto-Sync: toggle + interval input (minutes)
       - "Jetzt synchronisieren" button → manual sync of XSteps from SAP to local repository
     * Save button for all settings

4. Create server/services/sap.service.js — SAP integration service:

   This service is ONLY called when sap_integration_enabled is "true".

   testConnection():
   - Based on sap_connection_type, try to reach the configured endpoint
   - Return { success: boolean, message: string, latency_ms: number }

   syncXSteps(filters):
   - Fetch XSteps from SAP (via MCP or direct connector)
   - For each: check if exists in local repository
   - New XSteps: create in local DB
   - Changed XSteps: update in local DB (increment version)
   - Return sync report: { fetched, created, updated, unchanged }

   getProcessOrder(orderNumber):
   - Only available when SAP enabled
   - Fetch order details + operations + BOM from SAP
   - Return structured data that Claude can use

5. Extend server/services/llm.service.js:

   In generatePISheet():
   - Check: is SAP integration enabled?
   - If YES AND user prompt references a specific order number or line:
     * Try to fetch additional context from SAP via sap.service
     * Add SAP data to Claude context alongside local XSteps
   - If NO (default): use only local repository (existing behavior, no change)

   The key principle: SAP data ENRICHES the local repository, it never REPLACES it.
   Local repository is always the primary source.

6. SAP MCP Server (separate project, only needed when SAP enabled):

   Create sap-mcp-server/ as a sibling folder (NOT inside pi-sheet-generator):
   
   sap-mcp-server/
   ├── src/
   │   ├── index.js          # MCP Server with SSE transport on port 3001
   │   ├── tools/
   │   │   ├── xsteps.js     # get_xsteps tool
   │   │   ├── orders.js     # get_process_order tool  
   │   │   ├── materials.js  # get_material_master, get_movement_types tools
   │   │   └── routing.js    # get_routing, get_bom tools
   │   └── mock-data/        # Realistic German manufacturing mock data
   │       ├── xsteps.json
   │       ├── orders.json
   │       ├── materials.json
   │       └── movement-types.json
   ├── package.json
   ├── .env.example
   └── README.md

   Dependencies: @modelcontextprotocol/sdk, express (for SSE), dotenv
   
   All 6 tools return MOCK DATA for the pilot:
   - get_xsteps: 20+ realistic XSteps across Verpackung, Abfüllung, Granulation, Tablettierung
   - get_process_order: a sample order 1000234 with 8 operations and 12 BOM components
   - get_material_master: 10 sample materials with German descriptions
   - get_movement_types: all common SAP movement types (101, 261, 311, 531, etc.)
   - get_routing: sample routing with work centers and operation times
   - get_bom: sample BOM with components and quantities

   The mock data should be realistic enough for a convincing demo.
   Later, the mock responses get replaced with real SAP RFC/OData calls.

7. API routes server/routes/settings.routes.js (admin only):
   - GET    /api/settings → all settings
   - PUT    /api/settings/:key → update setting value
   - POST   /api/settings/sap/test-connection → test SAP connection
   - POST   /api/settings/sap/sync → manual XStep sync from SAP
   - GET    /api/settings/sap/status → { enabled, connected, last_sync, xsteps_synced }

8. Wire up: app.use('/api/settings', settingsRoutes)

9. Update docker-compose.yml — add optional sap-mcp-server service:
   sap-mcp:
     build: ../sap-mcp-server
     ports:
       - "3001:3001"
     profiles:
       - sap    # Only starts with: docker-compose --profile sap up

Test plan:
- Default: SAP toggle is OFF, everything works as before (offline, local repository)
- Turn ON SAP toggle → settings panel appears
- "Verbindung testen" with mock server running → ✅ Verbunden
- "Jetzt synchronisieren" → XSteps from mock SAP appear in local repository
- Chat with SAP enabled + order number: "PI Sheet für Auftrag 1000234" → Claude fetches order data via MCP
- Turn OFF SAP toggle → system immediately works offline again, no errors
- SAP MCP server NOT running + SAP enabled → graceful error: "SAP nicht erreichbar, verwende lokales Repository"
```

---

## Zusammenfassung: Reihenfolge

```
RUNDE 1 → Vision Backend         (Foto/Scan → PI Sheet erkennen)
RUNDE 2 → Vision Frontend        (Upload-Wizard UI)
RUNDE 3 → Wissensbasis RAG       (SOPs als Kontext für bessere Vorschläge)
RUNDE 4 → SAP Optional           (Admin-Schalter, MCP Server mit Mock-Daten)
```

Jede Runde ist eigenständig testbar. Runde 4 ist komplett optional — das System ist nach Runde 1-3 voll funktionsfähig.

---

## Quick-Test nach jeder Runde

### Nach Runde 1+2:
```
1. Öffne /digitalize
2. Lade ein Foto eines PI Sheets hoch
3. Prüfe: Schritte erkannt? Kategorien richtig? Repository-Matches?
4. Generiere PI Sheet → Preview in Digital + Druck
5. Speichere → erscheint in Templates
```

### Nach Runde 3:
```
1. Gehe zu /admin/knowledge
2. Lade eine SOP PDF hoch → Status wechselt zu "Bereit"
3. Gehe zum Chat → "PI Sheet für Verpackung"
4. Prüfe: Referenziert die Antwort Inhalte aus der SOP?
```

### Nach Runde 4:
```
1. Gehe zu /admin/settings
2. SAP Toggle ist AUS → alles funktioniert offline ✅
3. Starte sap-mcp-server: docker-compose --profile sap up
4. SAP Toggle AN → "Verbindung testen" → ✅
5. "Jetzt synchronisieren" → neue XSteps erscheinen im Repository
6. Chat: "PI Sheet für Auftrag 1000234" → Claude holt Auftragsdaten
7. SAP Toggle AUS → sofort wieder offline, keine Fehler ✅
```

---

## Troubleshooting

```
"Claude Vision gibt Fehler" → Prüfe: Bild zu groß? Resize auf max 2048px. API Key gesetzt?

"PDF wird nicht erkannt" → Ist es ein Scan? pdf-parse gibt leeren Text → Fallback auf Tesseract OCR

"Embeddings fehlen" → Kein Embedding API Key? Keyword-Fallback greift automatisch

"SAP MCP Server nicht erreichbar" → Läuft der Server? docker-compose --profile sap up -d
  → Graceful fallback: System nutzt lokales Repository, zeigt Warnung

"Import dauert ewig" → Große Dokumente: Chunking + Embedding braucht Zeit. 
  Background-Processing läuft async, UI pollt den Status.

"Cursor verliert Kontext" → "Read .cursorrules, MVP2-SPEC.md and continue with Runde N"
```
