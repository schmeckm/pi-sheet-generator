# X-Steps AI Composer — MVP 2.0 Erweiterungen

> **MCP-Integration mit SAP + RAG mit Bild/Dokument-Upload**
> Dieses Dokument ergänzt die .cursorrules für die nächste Ausbaustufe.

---

## Übersicht MVP Roadmap

```
MVP 1.0 (aktuell)          MVP 2.0 (dieses Dokument)         MVP 3.0 (Zukunft)
─────────────────           ──────────────────────────         ─────────────────
✅ Chat → PI Sheet          🔲 MCP → SAP Live-Anbindung        Simulation Engine
✅ Admin XStep Upload        🔲 RAG Bild-Upload → PI Sheet      Approval Workflow
✅ Template Preview          🔲 PDF/Scan → Digitalisierung      SAP Rückschreibung
✅ PDF Export                🔲 Multi-Modal Analyse              Shop Floor Tablet App
                            🔲 Vektorsuche auf Dokumenten       Audit Trail GxP-konform
```

---

# TEIL 1: MCP — SAP Live-Anbindung

## Konzept

Ein **MCP Server** stellt SAP-Daten als Tools für Claude bereit. Claude kann dann im Chat-Kontext live auf SAP zugreifen:

- "Zeig mir alle XSteps für Linie VP-03" → MCP fragt SAP ME
- "Welche Bewegungsarten gibt es für Verpackung?" → MCP fragt SAP MM
- "Erstelle ein PI Sheet basierend auf Fertigungsauftrag 1000234" → MCP holt Auftragsdaten + Stückliste + Arbeitspläne

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  X-Steps AI Composer (Node.js)                                │
│                                                               │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ Chat API  │───▶│ Claude API   │───▶│ MCP Client         │  │
│  │           │    │ + MCP Tools  │    │ (connects to       │  │
│  │           │    │              │    │  SAP MCP Server)    │  │
│  └──────────┘    └──────────────┘    └─────────┬──────────┘  │
│                                                 │             │
└─────────────────────────────────────────────────┼─────────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  SAP MCP Server (Node.js)   │
                                    │                              │
                                    │  Tools:                      │
                                    │  - get_xsteps               │
                                    │  - get_process_order         │
                                    │  - get_bom (Stückliste)     │
                                    │  - get_routing (Arbeitsplan)│
                                    │  - get_movement_types       │
                                    │  - get_material_master      │
                                    │  - search_pi_templates      │
                                    │                              │
                                    │  Connectors:                 │
                                    │  - SAP RFC (node-rfc)       │
                                    │  - SAP OData (axios)        │
                                    │  - SAP ME REST API          │
                                    └──────────────┬──────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  SAP Systems                 │
                                    │  - SAP S/4HANA (RFC/OData)  │
                                    │  - SAP ME/MES (REST API)    │
                                    │  - SAP PO (if applicable)   │
                                    └─────────────────────────────┘
```

## SAP MCP Server — Tool Definitionen

### Projektstruktur

```
sap-mcp-server/
├── src/
│   ├── index.js                  # MCP Server entry (stdio or SSE transport)
│   ├── tools/
│   │   ├── xsteps.js             # get_xsteps, search_xsteps
│   │   ├── process-order.js      # get_process_order, get_order_operations
│   │   ├── bom.js                # get_bom (Stückliste)
│   │   ├── routing.js            # get_routing (Arbeitsplan)
│   │   ├── materials.js          # get_material_master, get_movement_types
│   │   └── pi-templates.js       # search_pi_templates, get_template
│   ├── connectors/
│   │   ├── rfc.js                # SAP RFC via node-rfc
│   │   ├── odata.js              # SAP OData via axios
│   │   └── me-api.js             # SAP ME REST API
│   └── config.js                 # SAP connection config
├── package.json
└── .env
```

### Tool: get_xsteps

```javascript
{
  name: "get_xsteps",
  description: "Retrieves XStep definitions from SAP ME/MES for a given production line, process type, or work center. Returns step ID, name, category, parameters, and configuration.",
  inputSchema: {
    type: "object",
    properties: {
      line: { type: "string", description: "Production line ID, e.g. 'VP-03', 'AF-01'" },
      process_type: { type: "string", description: "Process type: Verpackung, Abfüllung, Granulation, etc." },
      work_center: { type: "string", description: "SAP Work Center ID" },
      active_only: { type: "boolean", default: true }
    }
  }
}

// Implementation calls SAP ME REST API:
// GET /sap/me/api/v1/process-instructions/steps?line={line}&status=active
// Or RFC: BAPI_PRODORD_GET_DETAIL for process order operations
```

### Tool: get_process_order

```javascript
{
  name: "get_process_order",
  description: "Retrieves a SAP production/process order with all operations, components, and routing. Use this to build a PI Sheet for a specific manufacturing order.",
  inputSchema: {
    type: "object",
    properties: {
      order_number: { type: "string", description: "SAP Process Order number, e.g. '1000234'" },
      include_bom: { type: "boolean", default: true, description: "Include bill of materials" },
      include_routing: { type: "boolean", default: true, description: "Include routing/operations" }
    },
    required: ["order_number"]
  }
}

// Implementation:
// RFC: BAPI_PROCORD_GET_DETAIL → order header
// RFC: BAPI_PROCORD_GET_COMP → BOM components
// RFC: BAPI_PROCORD_GET_OPERATIONS → routing steps
// Or OData: /sap/opu/odata/sap/API_PROCESS_ORDER_SRV/A_ProcessOrder('{order}')
```

### Tool: get_movement_types

```javascript
{
  name: "get_movement_types",
  description: "Lists SAP movement types (Bewegungsarten) relevant for goods movements in manufacturing. Use to determine correct movement type for Warenbewegung steps.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", enum: ["goods_receipt", "goods_issue", "transfer", "all"] }
    }
  }
}

// Returns common movement types:
// 101 - Wareneingang zur Bestellung
// 261 - Warenausgang für Auftrag
// 311 - Umlagerung Werk zu Werk
// 531 - Nebenerzeugnis zum Auftrag
// etc.
```

### Tool: get_material_master

```javascript
{
  name: "get_material_master",
  description: "Retrieves material master data from SAP including description, unit of measure, batch management flag, and storage data.",
  inputSchema: {
    type: "object",
    properties: {
      material_number: { type: "string" },
      search_term: { type: "string", description: "Search by material description" },
      plant: { type: "string", description: "SAP Plant code" }
    }
  }
}
```

## Integration in X-Steps AI Composer

### Option A: Claude API mit MCP Tools (empfohlen für Pilot)

```javascript
// In server/services/llm.service.js
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4000,
  system: systemPrompt,
  tools: [
    // Lokale Tools
    {
      type: "function",
      name: "search_xstep_repository",
      description: "Search internal XStep repository by semantic similarity",
      input_schema: { ... }
    },
    // MCP Tools — SAP Anbindung
    {
      type: "mcp",
      server: {
        type: "url",
        url: "http://localhost:3001/mcp",  // SAP MCP Server
        name: "sap-mcp"
      }
    }
  ],
  messages: [
    { role: "user", content: userPrompt }
  ]
});
```

### Option B: MCP Server als SSE Endpoint

```javascript
// sap-mcp-server/src/index.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new McpServer({
  name: "sap-manufacturing",
  version: "1.0.0"
});

// Register tools
server.tool("get_xsteps", schema, async (params) => {
  const steps = await sapMeConnector.getXSteps(params);
  return { content: [{ type: "text", text: JSON.stringify(steps) }] };
});

// Start SSE transport on port 3001
const transport = new SSEServerTransport("/mcp", response);
await server.connect(transport);
```

## SAP Connector Setup

### Für RFC (On-Premise SAP)
```bash
npm install node-rfc
# Requires SAP NW RFC SDK installed on the server
```

```javascript
// sap-mcp-server/src/connectors/rfc.js
const noderfc = require("node-rfc");

const client = new noderfc.Client({
  ashost: process.env.SAP_HOST,
  sysnr: process.env.SAP_SYSNR,
  client: process.env.SAP_CLIENT,
  user: process.env.SAP_USER,
  passwd: process.env.SAP_PASSWORD
});

async function getProcessOrder(orderNumber) {
  await client.open();
  const result = await client.call("BAPI_PROCORD_GET_DETAIL", {
    NUMBER: orderNumber
  });
  await client.close();
  return result;
}
```

### Für OData (S/4HANA Cloud)
```javascript
// sap-mcp-server/src/connectors/odata.js
const axios = require("axios");

const sapClient = axios.create({
  baseURL: process.env.SAP_ODATA_URL,
  auth: {
    username: process.env.SAP_USER,
    password: process.env.SAP_PASSWORD
  },
  headers: { "x-csrf-token": "Fetch" }
});

async function getProcessOrder(orderNumber) {
  const { data } = await sapClient.get(
    `/sap/opu/odata/sap/API_PROCESS_ORDER_SRV/A_ProcessOrder('${orderNumber}')?$expand=to_ProcessOrderOperation,to_ProcessOrderComponent`
  );
  return data.d;
}
```

### Für SAP ME REST API
```javascript
// sap-mcp-server/src/connectors/me-api.js
const axios = require("axios");

const meClient = axios.create({
  baseURL: process.env.SAP_ME_URL,
  headers: { "Authorization": `Bearer ${process.env.SAP_ME_TOKEN}` }
});

async function getXSteps(line, processType) {
  const { data } = await meClient.get("/sap/me/api/v1/process-instructions", {
    params: { line, processType, status: "active" }
  });
  return data.processInstructions;
}
```

---

# TEIL 2: RAG mit Bild/Dokument-Upload — PI Sheet Erkennung

## Konzept

Der User lädt ein bestehendes PI Sheet hoch — als:
- **Foto** (JPG/PNG) vom Papier-PI-Sheet auf dem Shop Floor
- **Scan** (PDF) eines bestehenden Chargenprotokolls
- **Word/Excel** Dokument einer bestehenden PI Vorlage
- **Screenshot** eines SAP ME Bildschirms

Das System analysiert das Dokument, extrahiert die Struktur (Schritte, Parameter, Kategorien), und generiert daraus ein digitales PI Sheet. Der User kann es dann bearbeiten und als Template speichern.

## Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│  Upload Flow                                                      │
│                                                                    │
│  Foto/PDF/Doc ──▶ Pre-Processing ──▶ Claude Vision ──▶ Structured │
│                    │                   API              Output     │
│                    │                   (Multi-Modal)    (JSON)     │
│                    ▼                                      │        │
│              ┌──────────┐                                 ▼        │
│              │ OCR      │                          ┌────────────┐  │
│              │ (Backup) │                          │ RAG Match  │  │
│              │ Tesseract│                          │ gegen      │  │
│              └──────────┘                          │ Repository │  │
│                                                    └─────┬──────┘  │
│                                                          ▼        │
│                                                   ┌────────────┐  │
│                                                   │ PI Sheet   │  │
│                                                   │ Vorschlag  │  │
│                                                   │ + Diff     │  │
│                                                   └────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Unterstützte Formate

| Format | Verarbeitung | Use Case |
|---|---|---|
| **JPG/PNG** | Claude Vision API direkt | Foto vom Papier-PI-Sheet |
| **PDF (digital)** | Text-Extraktion + Claude | Gescannte Dokumente, SAP PDF Export |
| **PDF (Scan/Bild)** | PDF → Bild → Claude Vision | Ältere gescannte Chargenprotokolle |
| **DOCX** | Text-Extraktion + Claude | Word-basierte PI Templates |
| **XLSX** | Tabellen-Extraktion + Claude | Excel-basierte PI Vorlagen |
| **Screenshot PNG** | Claude Vision direkt | SAP ME Bildschirmfoto |

## Backend Implementation

### Neue Dependencies

```bash
cd server
npm install sharp pdf-parse tesseract.js mammoth
```

- `sharp` — Bild-Optimierung (Resize, Kontrast, Rotation für bessere OCR)
- `pdf-parse` — PDF Text-Extraktion
- `tesseract.js` — OCR Fallback für schlechte Scans
- `mammoth` — DOCX Text-Extraktion

### server/services/vision.service.js

```
Der Vision Service verarbeitet hochgeladene Dokumente in 4 Phasen:

PHASE 1: PRE-PROCESSING
─────────────────────────
Basierend auf Dateityp:

JPG/PNG:
  - sharp: Resize auf max 2048px (Claude Vision Limit beachten)
  - sharp: Auto-Rotation (EXIF)
  - sharp: Kontrast erhöhen bei dunklen Fotos
  - Ergebnis: optimiertes Base64 Image

PDF:
  - pdf-parse: versuche Text-Extraktion
  - Wenn Text vorhanden (> 100 chars): nutze Text-Modus
  - Wenn kein Text (Scan): konvertiere jede Seite zu PNG via sharp
  - Ergebnis: Text ODER Array von Base64 Images

DOCX:
  - mammoth: extrahiere Text + Struktur (Tabellen, Listen, Überschriften)
  - Ergebnis: strukturierter Text

XLSX:
  - xlsx (SheetJS): extrahiere alle Sheets als JSON
  - Ergebnis: strukturierter Text mit Tabellendaten


PHASE 2: CLAUDE VISION / TEXT ANALYSE
──────────────────────────────────────
Sende an Claude API mit speziellem System-Prompt:

Für Bilder (Vision):
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: base64Image }
      },
      {
        type: "text",
        text: VISION_ANALYSIS_PROMPT
      }
    ]
  }]

Für Text:
  messages: [{
    role: "user",
    content: EXTRACTED_TEXT + "\n\n" + TEXT_ANALYSIS_PROMPT
  }]

Für mehrseitige PDFs:
  Sende alle Seiten als separate Image-Blöcke in einer Message.


PHASE 3: RAG MATCHING
──────────────────────
Die erkannten Schritte werden gegen das XStep Repository gematcht:

Für jeden erkannten Schritt:
  1. Erzeuge Embedding des Schritt-Textes
  2. Suche ähnlichste XSteps via pgvector (Cosine Similarity)
  3. Wenn Similarity > 0.85: direkter Match → verwende Repository-XStep
  4. Wenn Similarity 0.6-0.85: möglicher Match → zeige als Vorschlag
  5. Wenn Similarity < 0.6: kein Match → markiere als "Neu erkannt"

Ergebnis: Array von Schritten mit Match-Status und Confidence


PHASE 4: PI SHEET GENERIERUNG
──────────────────────────────
Kombiniere:
  - Erkannte Schritte mit Repository-Matches
  - Ergänze fehlende GMP-Schritte (Claude schlägt vor)
  - Generiere strukturiertes PI Sheet JSON

Ergebnis an Frontend:
{
  "source": { "type": "image", "filename": "pi-sheet-foto.jpg", "pages": 1 },
  "confidence": 0.87,
  "recognized_steps": 8,
  "matched_to_repository": 6,
  "new_steps": 2,
  "pi_sheet": { ... standard PI Sheet JSON ... },
  "matches": [
    {
      "step_nr": 1,
      "recognized_text": "Linienclearance durchführen",
      "matched_xstep": "XS-VP-001",
      "match_confidence": 0.92,
      "status": "matched"
    },
    {
      "step_nr": 5,
      "recognized_text": "Prüfung Serialisierung",
      "matched_xstep": null,
      "match_confidence": 0.0,
      "status": "new"
    }
  ]
}
```

### Vision Analysis Prompt

```javascript
const VISION_ANALYSIS_PROMPT = `Du analysierst ein Foto oder Scan eines pharmazeutischen PI Sheets (Process Instruction Sheet) oder Chargenprotokolls.

Extrahiere ALLE erkennbaren Informationen und gib sie als JSON zurück (ohne Markdown-Backticks):

{
  "document_type": "PI Sheet | Chargenprotokoll | Arbeitsanweisung | Unbekannt",
  "title": "Erkannter Titel des Dokuments",
  "process_type": "Verpackung | Abfüllung | Granulation | etc.",
  "metadata": {
    "document_number": "falls erkennbar",
    "version": "falls erkennbar",
    "product": "falls erkennbar",
    "line": "falls erkennbar"
  },
  "steps": [
    {
      "step_nr": 1,
      "name": "Name des Schritts",
      "category_guess": "Warenbewegung | Rückmeldung | Prozess | Qualität | Dokumentation",
      "instruction": "Erkannter Anweisungstext",
      "params": [
        { "name": "Parametername", "value": "vorausgefüllter Wert oder leer", "unit": "Einheit" }
      ],
      "has_signature_field": true,
      "confidence": 0.95
    }
  ],
  "notes": ["Erkannte Hinweise oder Bemerkungen"],
  "quality": {
    "image_quality": "good | medium | poor",
    "readability": "full | partial | low",
    "issues": ["Teilweise unleserlich in Bereich X", "Seite abgeschnitten"]
  }
}

Wichtig:
- Erkenne auch handschriftliche Einträge wenn möglich
- Bei unleserlichen Stellen: setze den Wert auf null und notiere es in quality.issues
- Versuche die Kategorie jedes Schritts zu erraten basierend auf dem Inhalt
- SAP-spezifische Begriffe (Bewegungsart, Rückmeldung, MIGO, CO11N) sind Hinweise für die Kategorisierung
- Wenn es ein mehrseitiges Dokument ist, nummeriere die Schritte durchgehend
- Sprache: Deutsch oder Englisch — gib alles so wieder wie es auf dem Dokument steht`;
```

### API Endpoints

```
POST /api/vision/analyze
  Request: multipart/form-data
    - file: JPG, PNG, PDF, DOCX, or XLSX (max 20MB)
    - mode: "analyze" (nur Erkennung) | "generate" (Erkennung + PI Sheet generieren)

  Response (mode: "analyze"):
  {
    status: "analyzed",
    source: { type, filename, pages },
    recognized: { ... Claude's analysis ... },
    quality: { image_quality, readability, issues }
  }

  Response (mode: "generate"):
  {
    status: "generated",
    source: { type, filename, pages },
    confidence: 0.87,
    pi_sheet: { ... vollständiges PI Sheet ... },
    matches: [ ... Match-Details pro Schritt ... ],
    quality: { ... }
  }

POST /api/vision/confirm
  Request: { pi_sheet_id, confirmed_steps: [...], edits: [...] }
  Response: { pi_sheet } — finales PI Sheet nach User-Review
```

## Frontend: Vision Upload Komponente

### Neuer Tab im ChatView oder eigene View

```
OPTION A: Integration in Chat
  User kann im Chat ein Bild/PDF per Drag & Drop oder 📎 Button hochladen.
  Chat zeigt: "Analysiere dein Dokument..." → Fortschrittsanzeige → Ergebnis

OPTION B: Eigene View /digitalize (empfohlen für Pilot)
  Dedizierte Seite mit Upload + Analyse + Review Flow
```

### DigitalizeView.vue — 4-Step Flow

```
STEP 1: UPLOAD
─────────────
- Großer Upload-Bereich mit Kamera-Icon
- "Foto, Scan oder Dokument hochladen"
- Akzeptierte Formate: JPG, PNG, PDF, DOCX, XLSX
- Max 20MB
- Vorschau des hochgeladenen Bildes/Dokuments
- "Analysieren" Button

STEP 2: ANALYSE-ERGEBNIS
─────────────────────────
Split View:
  Links: Original-Dokument (Bild/PDF Viewer)
  Rechts: Erkannte Struktur

- Qualitäts-Indikator: 🟢 Gut | 🟡 Mittel | 🔴 Schlecht
- Erkannte Metadaten: Titel, Prozesstyp, Produkt
- Liste der erkannten Schritte mit:
  * Schritt-Nr. und Name
  * Erkannte Kategorie (farbiger Badge)
  * Confidence Score (Prozentbalken)
  * Parameter-Liste
  * "Erkannt als: XS-VP-001" wenn Repository-Match gefunden
  * "Neu — nicht im Repository" wenn kein Match
- Warnungen bei schlechter Lesbarkeit

"PI Sheet generieren" Button

STEP 3: REVIEW + EDIT
──────────────────────
Das generierte PI Sheet in der bekannten Preview-Ansicht, ABER mit zusätzlichen Markierungen:

- 🟢 Grüner Rand: Match mit Repository-XStep (Confidence > 85%)
- 🟡 Gelber Rand: Möglicher Match (Confidence 60-85%), User muss bestätigen
- 🔴 Roter Rand: Neuer Schritt, nicht im Repository

Für jeden Schritt:
- Dropdown: "Repository-XStep zuweisen" (Suche im Repository)
- "Übernehmen wie erkannt" Button
- "Bearbeiten" Button → Inline-Editor
- "Entfernen" Button

Zusätzlich:
- "Fehlende GMP-Schritte ergänzen" → Claude schlägt vor
- "Parameter aus Repository übernehmen" → ersetzt erkannte Params mit Standard-Params

STEP 4: BESTÄTIGUNG
────────────────────
- Finales PI Sheet in Digital- und Druck-Ansicht
- "Als Template speichern" → speichert in DB
- "Neue XSteps zum Repository hinzufügen" → Option die neu erkannten Schritte ins Repository aufzunehmen
- "PDF herunterladen"
```

---

# TEIL 3: Erweitertes RAG — Dokument-Wissenbasis

## Konzept

Neben XSteps können auch ganze Dokumente als Wissensbasis dienen:
- SOPs (Standard Operating Procedures)
- Arbeitsanweisungen
- Bestehende Chargenprotokolle
- Validierungsdokumente
- Qualitätsrichtlinien

Diese werden vektorisiert und stehen Claude als zusätzlicher Kontext zur Verfügung.

## Dokument-Upload für Wissensbasis

### Neues Model: KnowledgeDocument

```sql
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,           -- pdf, docx, xlsx, txt
  file_size INTEGER,
  category VARCHAR(100),                     -- SOP, Arbeitsanweisung, Chargenprotokoll, etc.
  process_type VARCHAR(100),                 -- Verpackung, Abfüllung, etc.
  status VARCHAR(50) DEFAULT 'processing',   -- processing, ready, error
  page_count INTEGER,
  chunk_count INTEGER,                       -- Anzahl Text-Chunks nach Splitting
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,                      -- Der Text-Chunk
  page_number INTEGER,
  embedding vector(1536),                     -- Vektor-Embedding
  metadata JSONB                              -- { section, heading, table_data, etc. }
);

CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Document Processing Pipeline

```
1. UPLOAD
   - User lädt Dokument hoch (PDF, DOCX, XLSX)
   - Speichere Datei + erstelle knowledge_documents Eintrag
   - Status: "processing"

2. TEXT EXTRACTION
   - PDF: pdf-parse (Text) oder Tesseract (Scan)
   - DOCX: mammoth
   - XLSX: SheetJS
   - Ergebnis: Volltext mit Seitenreferenzen

3. CHUNKING
   - Teile Text in überlappende Chunks (~500 Tokens, 100 Token Overlap)
   - Behalte Kontext: Überschriften, Seitennummern
   - Spezielle Logik für Tabellen: ganze Tabelle = ein Chunk
   - Speichere als document_chunks

4. EMBEDDING
   - Generiere Embedding für jeden Chunk
   - Speichere in embedding Spalte

5. READY
   - Status: "ready"
   - Dokument steht für RAG-Suche bereit
```

### Erweiterte RAG-Pipeline im LLM Service

```javascript
async function generatePISheet(userPrompt, userId) {
  // 1. Suche relevante XSteps (wie bisher)
  const xsteps = await embeddingService.searchSimilarXSteps(userPrompt, { limit: 15 });

  // 2. NEU: Suche relevante Dokument-Chunks
  const docChunks = await embeddingService.searchDocumentChunks(userPrompt, { limit: 10 });

  // 3. Baue erweiterten Kontext
  const context = {
    xsteps: formatXSteps(xsteps),
    documents: docChunks.map(chunk => ({
      source: chunk.document.title,
      page: chunk.page_number,
      content: chunk.content
    }))
  };

  // 4. Erweiterter System-Prompt
  const systemPrompt = basePrompt + `\n\nDir stehen zusätzlich relevante Auszüge aus Unternehmensdokumenten zur Verfügung (SOPs, Arbeitsanweisungen, etc.). Nutze diese als Referenz für:
- Korrekte Formulierung von Anweisungen
- GMP-konforme Prozessschritte
- Parameter-Grenzwerte und Toleranzen
- Firmenpezifische Terminologie`;

  // 5. Claude API Call mit erweitertem Kontext
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Verfügbare XSteps:\n${context.xsteps}\n\nRelevante Dokumente:\n${JSON.stringify(context.documents)}\n\nUser-Anfrage: ${userPrompt}`
    }]
  });
}
```

### Admin UI: Wissensbasis-Verwaltung

```
Neue Admin-View: /admin/knowledge

- Upload-Bereich für Dokumente
- Tabelle: Titel, Typ, Kategorie, Prozesstyp, Seiten, Chunks, Status
- Status-Anzeige: Processing → Ready
- Kategorisierung per Dropdown
- Löschen mit Bestätigung
- Statistik: "X Dokumente, Y Chunks, Z MB"
```

---

# Cursor Prompt für MVP 2.0

## MCP Server (separates Projekt)

```
Create a new Node.js project "sap-mcp-server" that implements a Model Context Protocol server for SAP integration.

Read the MCP specification in IMPORT-SPEC.md Teil 1.

1. Initialize project with @modelcontextprotocol/sdk, node-rfc (optional), axios, dotenv
2. Implement 6 MCP tools: get_xsteps, get_process_order, get_bom, get_routing, get_movement_types, get_material_master
3. For the pilot: implement mock responses that return realistic SAP data (real SAP connection comes later)
4. SSE transport on port 3001
5. Test: Claude can call the tools and get structured SAP data back
```

## Vision/Document Upload (in bestehendes Projekt)

```
Read .cursorrules and IMPORT-SPEC.md Teil 2. Add document upload and vision analysis to the X-Steps AI Composer.

1. Install: sharp, pdf-parse, tesseract.js, mammoth
2. server/services/vision.service.js — 4-phase pipeline:
   - Pre-process (image optimization, PDF text extraction, DOCX parsing)
   - Claude Vision API analysis with the VISION_ANALYSIS_PROMPT
   - RAG matching against XStep repository
   - PI Sheet generation from recognized structure
3. API: POST /api/vision/analyze, POST /api/vision/confirm
4. Frontend: DigitalizeView.vue with 4-step flow (Upload → Analyze → Review → Confirm)
5. Support: JPG, PNG, PDF (text + scan), DOCX, XLSX
```

## Knowledge Base RAG (in bestehendes Projekt)

```
Read IMPORT-SPEC.md Teil 3. Add a document knowledge base with chunking and vector search.

1. New models: KnowledgeDocument, DocumentChunk (with pgvector embedding)
2. server/services/knowledge.service.js — upload, extract, chunk, embed pipeline
3. Extend LLM service: search document chunks alongside XSteps for richer context
4. Admin UI: /admin/knowledge — upload, list, categorize, delete documents
5. Status tracking: processing → ready with background job
```
