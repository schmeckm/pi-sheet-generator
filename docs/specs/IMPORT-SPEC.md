# PI Sheet Generator — Enhanced Import Module

> **Dieses Dokument ergänzt die .cursorrules und das Playbook.** Pfad: `docs/specs/IMPORT-SPEC.md`

---

## Übersicht

Der Admin kann XStep-Daten in folgenden Formaten importieren:

| Format | Use Case | Handling |
|---|---|---|
| **CSV** (.csv) | Einfacher Export aus Excel/SAP | csv-parser, Delimiter auto-detect (;,\t) |
| **Excel** (.xlsx, .xls) | Direkter SAP-Export, manuelle Pflege | xlsx (SheetJS) Library |
| **JSON** (.json) | API-Export, strukturierte Daten | Native JSON.parse |
| **XML** (.xml) | SAP ME/MES nativer Export | fast-xml-parser |
| **ZIP** (.zip) | Multi-File Export (XSteps + Parameter + Instructions) | adm-zip, dann Einzeldateien parsen |

---

## Zusätzliche Dependencies

```bash
cd server
npm install xlsx fast-xml-parser adm-zip
```

---

## Backend: Import Service Rewrite

### server/services/import.service.js

```
Die Import-Service Architektur:

1. DETECT FORMAT
   - Prüfe File Extension + MIME Type
   - .csv → CSV Parser
   - .xlsx / .xls → Excel Parser
   - .json → JSON Parser
   - .xml → XML Parser
   - .zip → ZIP Handler → entpacken → jede Datei einzeln durch den passenden Parser

2. PARSE FILE(S)
   Jeder Parser gibt ein einheitliches Zwischenformat zurück:
   {
     xsteps: [{ raw row data }],
     parameters: [{ xstep_id, param data }] | null,
     instructions: [{ xstep_id, instruction text }] | null,
     metadata: { source_format, row_count, detected_columns }
   }

3. COLUMN MAPPING
   - Auto-Mapping: versuche Spalten automatisch zuzuordnen anhand von:
     * Exakter Name-Match (case-insensitive): "name" → name, "xstep_id" → xstep_id
     * Alias-Match: "Bezeichnung"/"Description"/"Beschreibung" → description
     * SAP-typische Namen: "VORNR"/"Operation" → xstep_id, "LTXA1"/"Kurztext" → name
   - Wenn nicht alle Pflichtfelder gemappt: User muss manuell zuordnen im UI
   - Return: mapping { sourceColumn: targetField }

4. TRANSFORM + VALIDATE
   - Wende Mapping an: source rows → XStep objects
   - Wenn parameters[] vorhanden (aus ZIP): merge mit xsteps via xstep_id
   - Wenn instructions[] vorhanden: merge instruction_template
   - Validiere jeden XStep:
     * xstep_id: required, max 50 chars, unique within import
     * name: required, max 255 chars
     * category: required, must be one of: Warenbewegung, Rückmeldung, Prozess, Qualität, Dokumentation
       - Fuzzy match: "WB"/"Warenbew." → Warenbewegung, "RM"/"Rueckm." → Rückmeldung, etc.
     * process_type: required, max 100 chars
     * params: if present, validate each has at least "name"
   - Return: { valid: [...], warnings: [...], errors: [{ row, field, message }] }

5. UPSERT
   - For each valid XStep:
     * If xstep_id exists in DB → UPDATE (increment version, keep old embedding)
     * If new → CREATE
   - After all upserts: trigger embedAllXSteps() for new/updated entries
   - Audit log each action

6. REPORT
   Return: {
     total_rows: N,
     created: N,
     updated: N,
     skipped: N,
     errors: [{ row: N, field: "name", message: "Pflichtfeld fehlt" }],
     warnings: [{ row: N, message: "Kategorie 'WB' wurde zu 'Warenbewegung' konvertiert" }]
   }
```

### Individual Parsers

#### CSV Parser
```
- Use csv-parser library
- Auto-detect delimiter: try ';' first (common in German/SAP exports), then ',' then '\t'
- Auto-detect encoding: try UTF-8, fallback to Latin1/ISO-8859-1 (SAP exports often Latin1)
- Handle BOM (byte order mark) at file start
- Strip whitespace from headers and values
- Handle quoted fields with line breaks
```

#### Excel Parser (xlsx/SheetJS)
```
- Read the first sheet by default
- If multiple sheets: check sheet names for hints:
  * Sheet named "XSteps"/"Steps"/"Schritte"/"Master" → main XStep data
  * Sheet named "Parameter"/"Params"/"Details" → parameter data
  * Sheet named "Instructions"/"Anweisungen" → instruction templates
- If no obvious names: use first sheet as XSteps, second as Parameters (if exists)
- Convert each sheet to JSON array
- Handle merged cells (use the value from the top-left cell)
- Handle date columns (convert to ISO string)
- Handle number formatting (German comma decimals → dots)
```

#### JSON Parser
```
- Accept two structures:
  A) Flat array: [{ xstep_id, name, category, ... }]
  B) Nested with params: [{ xstep_id, name, params: [{name, type}], ... }]
  C) Wrapped: { xsteps: [...], parameters: [...] }
- Auto-detect which structure and normalize
```

#### XML Parser
```
- Use fast-xml-parser with these options:
  * ignoreAttributes: false (SAP uses attributes)
  * attributeNamePrefix: "@_"
- Handle common SAP XML structures:
  A) <XSteps><XStep id="XS-VP-001"><Name>...</Name></XStep></XSteps>
  B) <ProcessInstructions><Step StepId="...">...</Step></ProcessInstructions>
  C) Generic: find the repeating element, use its children as fields
- Extract into the same normalized format as other parsers
```

#### ZIP Handler
```
- Use adm-zip to extract
- List all files in the ZIP
- Categorize each file:
  * By extension: .csv, .xlsx, .json, .xml
  * By name: containing "xstep"/"step"/"master" → main data
  * By name: containing "param"/"detail" → parameters
  * By name: containing "instruct"/"anweis" → instructions
- Parse each file through the appropriate parser
- Merge results: parameters join to xsteps via xstep_id
- If ambiguous (multiple files, can't determine role): return metadata to frontend
  and let admin assign roles in the UI
```

---

## Column Auto-Mapping Aliases

```javascript
const COLUMN_ALIASES = {
  xstep_id: [
    'xstep_id', 'xstepid', 'step_id', 'stepid', 'id',
    'vornr', 'operation', 'op_id', 'operationid',
    'schritt_nr', 'schrittnr', 'step_number',
    'pi_step', 'pistep'
  ],
  name: [
    'name', 'bezeichnung', 'description_short', 'kurztext',
    'ltxa1', 'step_name', 'stepname', 'titel', 'title',
    'schrittname', 'short_text'
  ],
  category: [
    'category', 'kategorie', 'cat', 'type', 'typ',
    'step_type', 'steptype', 'schrittart',
    'wb', 'rm', 'qa', 'dok'
  ],
  process_type: [
    'process_type', 'processtype', 'prozesstyp', 'prozess',
    'process', 'area', 'bereich', 'werksbereich',
    'production_area', 'line_type'
  ],
  description: [
    'description', 'beschreibung', 'desc', 'long_text',
    'langtext', 'ltxa2', 'details', 'bemerkung',
    'instruction', 'anweisung'
  ],
  sap_transaction: [
    'sap_transaction', 'transaction', 'transaktion', 'tcode',
    't_code', 'sap_tcode', 'transaktionscode'
  ],
  movement_type: [
    'movement_type', 'bewegungsart', 'bwart', 'mvt_type',
    'movetype', 'bew_art'
  ],
  gmp_relevant: [
    'gmp_relevant', 'gmp', 'gxp', 'gmp_flag',
    'qualitaetsrelevant', 'quality_relevant', 'gmp_kritisch'
  ],
  signature_required: [
    'signature_required', 'signatur', 'unterschrift',
    'sign_required', 'visum', 'freigabe_erforderlich'
  ],
  instruction_template: [
    'instruction_template', 'instruction', 'anweisung',
    'arbeitsanweisung', 'operator_instruction',
    'work_instruction', 'sop_text'
  ]
};

// Category normalization
const CATEGORY_ALIASES = {
  'Warenbewegung': ['warenbewegung', 'wb', 'warenbew', 'goods_movement', 'gm', 'material_movement', 'mm'],
  'Rückmeldung': ['rückmeldung', 'rueckmeldung', 'rm', 'rueckm', 'confirmation', 'conf', 'backflush'],
  'Prozess': ['prozess', 'process', 'proc', 'pr', 'production', 'prod'],
  'Qualität': ['qualität', 'qualitaet', 'quality', 'qa', 'qc', 'ipc', 'qual'],
  'Dokumentation': ['dokumentation', 'documentation', 'dok', 'doc', 'docu', 'protokoll', 'record']
};
```

---

## API Endpoint Update

### POST /api/xsteps/import

```
Request: multipart/form-data
  - file: the uploaded file (CSV, XLSX, JSON, XML, or ZIP)
  - mapping: JSON string (optional, if admin did manual mapping)
    e.g. '{"Bezeichnung":"name","StepNr":"xstep_id","Bereich":"process_type"}'
  - file_roles: JSON string (optional, for ZIP with ambiguous files)
    e.g. '{"data.csv":"xsteps","params.csv":"parameters"}'
  - options: JSON string (optional)
    e.g. '{"delimiter":";","encoding":"latin1","sheet":"Sheet2"}'

Response flow:

Step 1 — If no mapping provided:
  HTTP 200 with preview response:
  {
    status: "preview",
    detected_format: "csv",
    detected_delimiter: ";",
    detected_encoding: "utf-8",
    columns: ["StepNr", "Bezeichnung", "Kategorie", "Bereich", ...],
    auto_mapping: { "StepNr": "xstep_id", "Bezeichnung": "name", ... },
    unmapped_required: ["process_type"],  // required fields not auto-mapped
    preview_rows: [ first 5 rows as objects ],
    total_rows: 48,
    // For ZIP:
    files: [
      { name: "xsteps.csv", detected_role: "xsteps", rows: 48 },
      { name: "params.csv", detected_role: "parameters", rows: 156 }
    ]
  }

Step 2 — With mapping provided (admin confirmed/adjusted):
  HTTP 200 with validation response:
  {
    status: "validated",
    valid: 42,
    warnings: 3,
    errors: 3,
    error_details: [{ row: 12, field: "category", message: "Unbekannte Kategorie: 'XY'" }],
    warning_details: [{ row: 5, message: "Kategorie 'WB' → 'Warenbewegung' konvertiert" }]
  }

Step 3 — With mapping + confirm=true:
  HTTP 200 with import result:
  {
    status: "completed",
    created: 35,
    updated: 7,
    skipped: 3,
    errors: 3,
    error_details: [...],
    duration_ms: 2340
  }
```

The frontend calls the same endpoint three times (preview → validate → import) with increasing parameters. This keeps the API simple while giving the admin full control.

---

## Frontend: Enhanced Upload Wizard

### UploadView.vue — 6-Step Wizard

```
STEP 1: FILE UPLOAD
- Large drag & drop zone (dashed border, icon)
- Accepted formats shown: CSV, Excel (.xlsx), JSON, XML, ZIP
- File size limit: 50MB
- After drop/select: show file name, size, detected format icon
- "Weiter" button → calls /api/xsteps/import (no mapping) → gets preview

STEP 2: FILE OVERVIEW (for ZIP only, skip for single files)
- Shows list of files found in ZIP
- Each file: name, detected role (XSteps / Parameters / Instructions / Unknown), row count
- Admin can reassign roles via dropdown if auto-detection was wrong
- "Weiter" button

STEP 3: DATA PREVIEW
- Table showing first 10 rows of the main XStep data
- Column headers shown
- Total row count: "156 Einträge erkannt"
- Detected settings shown: Format, Delimiter, Encoding
- Admin can override: dropdown for delimiter (auto, ;, comma, tab), encoding (UTF-8, Latin1)
- "Weiter" button

STEP 4: COLUMN MAPPING (ColumnMapper.vue)
- Two-column layout:
  LEFT: Source columns from file (with sample values shown)
  RIGHT: Target XStep field dropdown
- Auto-mapped columns shown in green with ✓
- Unmapped required fields highlighted in red with ⚠
- Required fields: xstep_id, name, category, process_type
- Optional fields: description, sap_transaction, movement_type, gmp_relevant, 
  signature_required, instruction_template
- "Ignorieren" option in dropdown to skip a column
- Live preview: show 3 rows as they would look after mapping
- "Weiter" button (disabled until all required fields mapped)

STEP 5: VALIDATION RESULTS
- Summary cards: ✅ Gültig: 42 | ⚠ Warnungen: 3 | ❌ Fehler: 3
- Expandable warning list (yellow): auto-corrections like category aliases
- Expandable error list (red): row number, field, error message
- Options:
  "Importieren" (imports valid rows, skips errors)
  "Alle importieren" (force import, including warnings — errors still skipped)
  "Zurück" to fix mapping
  "CSV herunterladen" — download error rows as CSV for correction and re-upload

STEP 6: IMPORT RESULT
- Progress bar during import
- Final result:
  🟢 Erstellt: 35 neue XSteps
  🔄 Aktualisiert: 7 bestehende XSteps (neue Version)
  ⏭️ Übersprungen: 3
  ❌ Fehler: 3
- Duration: "Import abgeschlossen in 2.3 Sekunden"
- Buttons: "Zum Repository" | "Weiteren Import starten"
- Auto-trigger embedding generation in background
```

---

## Example Import Files for Testing

### test-single.csv (German delimiters)
```csv
StepNr;Bezeichnung;Kategorie;Bereich;Beschreibung;SAP_TCode;BewArt;GMP
XS-TAB-001;Tablettierung starten;Prozess;Tablettierung;Starten Sie die Tablettenpresse;CO02;;Nein
XS-TAB-002;IPC Härteprüfung;Qualität;Tablettierung;Prüfen Sie die Tablettenhärte;;;Ja
XS-TAB-003;IPC Zerfallstest;QA;Tablettierung;Zerfallstest gemäß Arzneibuch;;;Ja
XS-TAB-004;Rückmeldung Tablettierung;RM;Tablettierung;Melden Sie den Auftrag zurück;CO11N;;Nein
XS-TAB-005;Metalldetektor-Check;Qualität;Tablettierung;Funktionsprüfung Metalldetektor;;;Ja
XS-COA-001;Coating-Lösung ansetzen;Prozess;Coating;Coating-Lösung gemäß Rezeptur;;;Nein
XS-COA-002;Coating-Parameter einstellen;Prozess;Coating;Zulufttemperatur und Sprührate;;;Nein
XS-COA-003;RM Coating;Rückmeldung;Coating;Coating-Auftrag zurückmelden;CO11N;;Nein
```

### test-with-params.zip (Multi-file)
Contains:
- `master.xlsx` — Sheet "Steps" with XStep definitions, Sheet "Params" with parameters
- `instructions.csv` — xstep_id + instruction text

### test-sap-export.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ProcessInstructions>
  <XStep StepId="XS-BLK-001" GMP="true">
    <Name>Ansatzbereitung</Name>
    <Category>Prozess</Category>
    <ProcessType>Bulkherstellung</ProcessType>
    <Description>Bereiten Sie den Ansatz gemäß Herstellanweisung vor.</Description>
    <SAPTransaction>CO02</SAPTransaction>
    <Parameters>
      <Param Name="Ansatz-Nr." Type="input" Required="true"/>
      <Param Name="Sollmenge" Type="display" Unit="kg"/>
      <Param Name="Istmenge" Type="input" Unit="kg" Required="true"/>
      <Param Name="Temperatur" Type="input" Unit="°C" Required="true"/>
    </Parameters>
  </XStep>
  <XStep StepId="XS-BLK-002" GMP="false">
    <Name>Rückmeldung Bulk</Name>
    <Category>Rückmeldung</Category>
    <ProcessType>Bulkherstellung</ProcessType>
    <Description>Melden Sie den Herstellauftrag im SAP zurück.</Description>
    <SAPTransaction>CO11N</SAPTransaction>
    <Parameters>
      <Param Name="Auftrag" Type="input" Required="true"/>
      <Param Name="Vorgang" Type="input" Required="true"/>
      <Param Name="Gutmenge" Type="input" Unit="kg" Required="true"/>
    </Parameters>
  </XStep>
</ProcessInstructions>
```

### test-flat.json
```json
[
  {
    "xstep_id": "XS-INS-001",
    "name": "Sichtprüfung",
    "category": "Qualität",
    "process_type": "Inspektion",
    "description": "Führen Sie die visuelle Inspektion der Behältnisse durch.",
    "gmp_relevant": true,
    "signature_required": true,
    "params": [
      { "name": "Prüflos-Nr.", "type": "input", "required": true },
      { "name": "Stichprobengröße", "type": "display", "unit": "Stk" },
      { "name": "Befund OK", "type": "checkbox", "required": true },
      { "name": "Ausschuss", "type": "input", "unit": "Stk" }
    ]
  },
  {
    "xstep_id": "XS-INS-002",
    "name": "AQL Bewertung",
    "category": "Qualität",
    "process_type": "Inspektion",
    "description": "Bewerten Sie das Prüflos nach AQL-Kriterien.",
    "gmp_relevant": true,
    "params": [
      { "name": "AQL Level", "type": "display" },
      { "name": "Akzeptanzzahl", "type": "display" },
      { "name": "Fehleranzahl", "type": "input", "required": true },
      { "name": "Ergebnis", "type": "input", "required": true }
    ]
  }
]
```

---

## Updated Cursor Prompt for Step 3

Replace the import section in Step 3 of the playbook with:

```
For the import service, implement the enhanced multi-format import as defined in IMPORT-SPEC.md:

Additional npm dependencies: npm install xlsx fast-xml-parser adm-zip

1. server/services/import.service.js — complete rewrite supporting:
   - Format detection from file extension + MIME type
   - CSV parser with auto-detect delimiter (;,\t) and encoding (UTF-8, Latin1), BOM handling
   - Excel parser using SheetJS (xlsx): read first sheet, detect multi-sheet (XSteps + Parameters)
   - JSON parser: support flat array, nested with params, and wrapped { xsteps, parameters } formats
   - XML parser using fast-xml-parser: handle SAP-style structures with attributes
   - ZIP handler using adm-zip: extract, categorize files by name/extension, parse each through appropriate parser, merge results
   - Column auto-mapping with comprehensive German/English/SAP alias lists (see IMPORT-SPEC.md COLUMN_ALIASES)
   - Category normalization with fuzzy matching (see IMPORT-SPEC.md CATEGORY_ALIASES)
   - Three-phase endpoint: preview → validate → import (same POST endpoint, behavior changes based on whether mapping/confirm params are present)

2. Update POST /api/xsteps/import to support the three-phase flow:
   - No mapping → return preview (columns, auto-mapping, sample rows)
   - With mapping → return validation (valid/warning/error counts with details)
   - With mapping + confirm=true → execute import, return results

3. Multer config: memory storage, max 50MB, accept .csv .xlsx .xls .json .xml .zip

4. Include all test files from IMPORT-SPEC.md in server/test-data/ for testing:
   - test-single.csv (German semicolon delimiters, alias categories)
   - test-sap-export.xml
   - test-flat.json
```

---

## Updated Cursor Prompt for Step 10 (Upload Wizard)

Replace the UploadView section in Step 10 with:

```
For the Upload Wizard (UploadView.vue), implement the enhanced 6-step flow from IMPORT-SPEC.md:

Step 1 — FILE UPLOAD: Drag & drop zone, accepted formats (CSV, Excel, JSON, XML, ZIP), 50MB limit, format auto-detection with icon

Step 2 — FILE OVERVIEW (ZIP only): List files in ZIP, show detected roles (XSteps/Parameters/Instructions), let admin reassign roles

Step 3 — DATA PREVIEW: Table with first 10 rows, column headers, total count, detected delimiter/encoding with override dropdowns

Step 4 — COLUMN MAPPING: Two-column layout, auto-mapped fields in green, unmapped required fields in red, live preview of 3 transformed rows, "Ignorieren" option for unused columns

Step 5 — VALIDATION: Summary cards (valid/warnings/errors), expandable lists, "Importieren"/"Zurück"/"Fehler-CSV herunterladen" buttons

Step 6 — RESULT: Progress bar, final counts (created/updated/skipped/errors), duration, links to repository

The wizard calls POST /api/xsteps/import three times:
1. Upload file (no mapping) → gets preview + auto-mapping
2. Submit with mapping → gets validation
3. Submit with mapping + confirm → gets import result

Each step has a progress indicator (step dots/bar at top) and back navigation.
German labels for the operator-facing parts.
```
