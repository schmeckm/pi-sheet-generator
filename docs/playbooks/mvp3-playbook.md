# X-Steps AI Composer — MVP 3.0 Cursor Playbook

> **Voraussetzung**: MVP 1.0 (11 Steps) + MVP 2.0 (4 Runden) sind komplett.
> Specs: `docs/specs/EQUIPMENT-SPEC.md` · Playbook: `docs/playbooks/mvp3-playbook.md`
> Jeder Prompt geht in den Cursor Composer (Cmd+I).

---

## Was MVP 3.0 bringt

- **Waagen-Simulation** mit realistischem Physik-Verhalten direkt im PI Sheet
- **OPC UA + MQTT + UNS (Sparkplug B)** Anbindung für echte Industriewaagen
- **Chat-basierte Prozessparameter-Abfrage**: "Welche Parameter hat die Waage W-GR-04?" oder "Zeig mir alle Sensoren auf Linie VP-03"
- **Equipment-Discovery**: Claude kann über den Chat verfügbare Geräte, ihre Parameter und Live-Werte abfragen
- **GMP Audit Trail**: Jede Wägung mit Raw-Daten, Timestamps, 4-Augen-Prinzip

---

## RUNDE 5 — Equipment Backend: Gateway + Simulation + Protokolle

```
Read .cursorrules and EQUIPMENT-SPEC.md. Build the equipment integration backend with protocol abstraction and scale simulation.

1. Install new dependencies in /server:
   npm install node-opcua mqtt sparkplug-client ws

2. New Sequelize models — run db:sync after:

   server/models/EquipmentConfig.js:
   - id: UUID PK
   - equipment_id: STRING(50), unique, not null (e.g. "W-GR-04")
   - name: STRING(255), not null (e.g. "Mettler Toledo ICS689")
   - equipment_type: STRING(50), not null — ENUM: "scale", "temperature", "barcode", "ph_meter", "timer"
   - location: STRING(255) (e.g. "Gebäude 42, Linie VP-03")
   - connection_type: STRING(50), default "simulation" — ENUM: "simulation", "opcua", "mqtt", "uns_sparkplug"
   - connection_config: JSONB, default {}
     For opcua: { endpoint: "opc.tcp://192.168.1.100:4840", nodePrefix: "ns=2;s=Scale.W-GR-04", securityMode: "None", username: "", password: "" }
     For mqtt: { broker: "mqtt://192.168.1.50:1883", topicPrefix: "pharma/basel/line-vp-03/scale/w-gr-04", qos: 1, username: "", password: "" }
     For uns_sparkplug: { broker: "mqtt://uns-broker:1883", groupId: "Pharma", edgeNodeId: "Basel/Building42/Line-VP-03", deviceId: "W-GR-04", username: "", password: "" }
     For simulation: { updateRate: 100, noise: 0.002, maxWeight: 50.0, resolution: 0.001 }
   - scale_config: JSONB, default {} — { maxCapacity: 50.0, resolution: 0.001, unit: "kg", calibrationInterval: 365, lastCalibration: "2025-12-01" }
   - process_parameters: JSONB, default [] — list of all parameters this equipment can provide:
     [
       { name: "GrossWeight", dataType: "Float", unit: "kg", description: "Brutto-Gewicht", readable: true, writable: false },
       { name: "NetWeight", dataType: "Float", unit: "kg", description: "Netto-Gewicht nach Tara", readable: true, writable: false },
       { name: "TareWeight", dataType: "Float", unit: "kg", description: "Tara-Gewicht", readable: true, writable: false },
       { name: "Stable", dataType: "Boolean", unit: "", description: "Messwert ist stabil", readable: true, writable: false },
       { name: "Unit", dataType: "String", unit: "", description: "Aktuelle Einheit", readable: true, writable: false },
       { name: "Overload", dataType: "Boolean", unit: "", description: "Überlast-Warnung", readable: true, writable: false },
       { name: "Status", dataType: "Int", unit: "", description: "0=OK, 1=Error, 2=Calibrating", readable: true, writable: false },
       { name: "CalibrationDate", dataType: "DateTime", unit: "", description: "Letzte Kalibrierung", readable: true, writable: false }
     ]
   - is_active: BOOLEAN, default true
   - is_online: BOOLEAN, default false
   - last_seen: DATE
   - timestamps

   server/models/WeighingRecord.js:
   - id: UUID PK
   - pi_sheet_id: UUID FK → pi_sheets (nullable, can weigh without PI Sheet)
   - pi_sheet_step_id: UUID FK → pi_sheet_steps (nullable)
   - equipment_id: STRING(50) FK → equipment_configs.equipment_id
   - gross_weight: DECIMAL(10,3)
   - tare_weight: DECIMAL(10,3)
   - net_weight: DECIMAL(10,3)
   - unit: STRING(10), default "kg"
   - target_weight: DECIMAL(10,3)
   - tolerance_abs: DECIMAL(10,3)
   - tolerance_pct: DECIMAL(5,2)
   - deviation: DECIMAL(10,3)
   - in_tolerance: BOOLEAN
   - material_number: STRING(50)
   - material_name: STRING(255)
   - batch_number: STRING(50)
   - stable_reading: BOOLEAN, default true
   - reading_count: INTEGER
   - stability_duration_ms: INTEGER
   - weighed_by: UUID FK → users
   - verified_by: UUID FK → users (4-Augen)
   - weighed_at: DATE, default NOW
   - verified_at: DATE
   - raw_readings: JSONB — [{ timestamp, gross, net, tare, stable }, ...] every 100ms
   - connection_source: STRING(50) — "simulation", "opcua", "mqtt", "uns_sparkplug"
   - timestamps

   Associations:
   - WeighingRecord belongsTo PISheet
   - WeighingRecord belongsTo PISheetStep
   - WeighingRecord belongsTo User (as weighedBy)
   - WeighingRecord belongsTo User (as verifiedBy)

3. Equipment Gateway — server/services/equipment/gateway.service.js:
   
   This is the CENTRAL HUB. It manages all equipment connections and provides a unified interface.
   The frontend and the LLM service both talk to this — never directly to a connector.

   class EquipmentGateway {
     // Stores active connections: Map<equipmentId, { connector, simulator, subscribers, lastValues }>
     
     async connect(equipmentId):
       - Load EquipmentConfig from DB
       - Based on connection_type:
         "simulation" → create ScaleSimulator, start tick interval
         "opcua" → create OPCUAConnector, try connect, on failure → fallback to simulation + log warning
         "mqtt" → create MQTTConnector, try connect, on failure → fallback to simulation
         "uns_sparkplug" → create SparkplugConnector, try connect, on failure → fallback to simulation
       - Update is_online in DB
       - Start pushing normalized data to all subscribers

     disconnect(equipmentId):
       - Stop connector/simulator
       - Update is_online = false

     subscribe(equipmentId, callback) → returns unsubscribe function:
       - Add callback to subscribers list
       - Callback receives normalized data: { equipmentId, values: { grossWeight, netWeight, tareWeight, stable, unit, overload, status }, timestamp, source }

     sendCommand(equipmentId, command, params):
       - "tare" → call connector.tare() or simulator.tare()
       - "addWeight" → simulator only: simulator.addWeight(params.amount)
       - "reset" → simulator only: simulator.reset()
       - "zero" → call connector zero if supported
       - Returns { success, message }

     getStatus(equipmentId) → { online, connection_type, actual_source, lastValues, lastSeen }
     getCurrentValue(equipmentId) → latest normalized values
     
     // NEW: For chat-based parameter discovery
     getEquipmentList(filters) → list of all configured equipment with status
     getEquipmentParameters(equipmentId) → process_parameters from config + current live values
     getEquipmentByLocation(location) → equipment at a specific location/line
     getEquipmentByType(type) → all equipment of a type (all scales, all sensors)
     getLiveSnapshot(equipmentId) → current values of ALL parameters with metadata
   }

   Important behaviors:
   - Auto-reconnect every 30s on connection failure
   - Fallback to simulation is automatic and logged
   - Frontend sees a warning badge "Simulation — Waage nicht erreichbar" when in fallback
   - All data flows through the same normalized format regardless of source

4. Scale Simulator — server/services/equipment/simulator.service.js:

   class ScaleSimulator {
     constructor(config):
       - maxCapacity (default 50.0 kg)
       - resolution (default 0.001 kg)  
       - noise (default 0.002 kg, gaussian)
       - updateRate (default 100ms = 10Hz)
       - Internal state: currentGross, currentTare, stable, settling, settlingTarget, settlingProgress

     tick() → called every updateRate ms:
       - If settling (material being added):
         * Progress 0..1 over ~3 seconds
         * Exponential approach with slight overshoot: overshoot = 1.0 + 0.03 * sin(t * PI * 3) * (1-t)
         * Instable during settling
       - Add gaussian noise: Box-Muller transform * noise amplitude
       - Round to resolution
       - Stability detection: if value changes < 1 digit for 2 seconds → stable = true
       - Return { grossWeight, netWeight, tareWeight, stable, unit, overload, status }

     tare():
       - Set tareWeight = current grossWeight
       - Return tareWeight

     addWeight(amount):
       - Start settling behavior toward current + amount
       - Takes ~3 seconds to stabilize with realistic overshoot
       - Marks as unstable during settling

     reset():
       - All values to 0, stable = true

     // NEW: Simulate realistic scenarios
     simulateDrift(rate):
       - Slowly change weight over time (material settling, temperature effect)
     
     simulateDisturbance():
       - Sudden instability (someone bumps the table, air current)
       - Recovers after 1-2 seconds
   }

5. OPC UA Connector — server/services/equipment/opcua.connector.js:

   class OPCUAConnector {
     constructor(config): endpoint, nodePrefix, securityMode, username, password
     
     async connect():
       - OPCUAClient.create() with security settings
       - client.connect(endpoint)
       - createSession with credentials
     
     async subscribe(callback):
       - Create subscription (publishingInterval: 100ms)
       - Monitor nodes: GrossWeight, NetWeight, TareWeight, Stable, Status, Overload, CalibrationDate
       - On change → callback(nodeName, value, timestamp)
     
     async tare():
       - Call OPC UA Method: {nodePrefix}.Tare()
     
     async readValue(nodeName):
       - Read single node value
     
     async readAllValues():
       - Read all monitored nodes in one call → return as object
     
     async browseParameters():
       - Browse the node tree under nodePrefix
       - Return list of all available nodes with dataType and description
       - This enables dynamic parameter discovery
     
     async disconnect()
   }

6. MQTT Connector — server/services/equipment/mqtt.connector.js:

   class MQTTConnector {
     constructor(config): broker, topicPrefix, qos, username, password
     
     async connect():
       - mqtt.connect(broker, { username, password, reconnectPeriod: 5000 })
     
     subscribe(callback):
       - Subscribe to {topicPrefix}/#
       - On message: parse topic suffix as field name, parse value, callback(field, value, timestamp)
     
     async tare():
       - Publish to {topicPrefix}/cmd/tare with payload "1"
     
     async readAllValues():
       - Return last received values from all topics (cached internally)
     
     async discoverTopics():
       - Subscribe briefly to wildcard, collect all topics that appear
       - Return as parameter list
     
     async disconnect()
   }

7. Sparkplug B / UNS Connector — server/services/equipment/sparkplug.connector.js:

   class SparkplugConnector {
     constructor(config): broker, groupId, edgeNodeId, deviceId, username, password
     
     async connect():
       - sparkplug.newClient({ serverUrl, groupId, edgeNode, clientId })
     
     subscribe(callback):
       - Listen for DDATA messages for this deviceId
       - Extract metrics → callback(metricName, value, timestamp)
     
     async tare():
       - Publish DCMD: { metrics: [{ name: "Tare", value: true, type: "Boolean" }] }
     
     async readAllValues():
       - Return last DDATA metrics
     
     async getDeviceBirth():
       - Return DBIRTH data (full device metadata + all available metrics)
       - This is the UNS way of parameter discovery
     
     async disconnect()
   }

8. Weighing Service — server/services/equipment/weighing.service.js:

   class WeighingService {
     async startWeighing(equipmentId, params):
       - params: { targetWeight, toleranceAbs, tolerancePct, materialNumber, materialName, batchNumber, piSheetId, piSheetStepId }
       - Begin recording raw readings from equipment gateway
       - Return session ID
     
     async confirmWeighing(sessionId, userId):
       - Stop recording raw readings
       - Calculate: deviation = netWeight - targetWeight
       - Check tolerance: |deviation| <= toleranceAbs
       - Create WeighingRecord with all data + raw readings
       - Return weighing record
     
     async verifyWeighing(weighingId, verifierId):
       - 4-Augen: second user confirms the weighing
       - Update verified_by, verified_at
       - Return updated record
     
     async getWeighingHistory(filters):
       - Filter by: piSheetId, equipmentId, dateRange, inTolerance
       - Include raw_readings count, NOT the full array (too large for list)
     
     async getWeighingAudit(weighingId):
       - Return full record INCLUDING raw_readings array
       - This is the GMP audit trail
   }

9. WebSocket Server — server/websocket/equipment.ws.js:

   Setup: attach to existing HTTP server at path /ws/equipment

   const WebSocket = require("ws");
   
   On connection:
     - Parse auth token from URL query or first message
     - Verify JWT → get userId
     
   Message protocol (client → server):
     { action: "subscribe", equipmentId: "W-GR-04" }
       → gateway.subscribe(equipmentId) → start streaming data
     
     { action: "unsubscribe", equipmentId: "W-GR-04" }
       → stop streaming for this equipment
     
     { action: "command", equipmentId: "W-GR-04", command: "tare" }
       → gateway.sendCommand() → reply with result
     
     { action: "command", equipmentId: "W-GR-04", command: "addWeight", params: { amount: 25.0 } }
       → simulation only → reply with result
     
     { action: "command", equipmentId: "W-GR-04", command: "reset" }
       → simulation only → reply with result
     
     { action: "list" }
       → gateway.getEquipmentList() → send equipment list with status
     
     { action: "snapshot", equipmentId: "W-GR-04" }
       → gateway.getLiveSnapshot() → send all current parameter values

   Message protocol (server → client):
     { type: "data", equipmentId: "W-GR-04", values: { grossWeight, netWeight, tareWeight, stable, unit, overload, status }, timestamp, source: "simulation" }
       → sent at equipment update rate (10Hz for simulation)
     
     { type: "status", equipmentId: "W-GR-04", online: true, source: "opcua", fallback: false }
     
     { type: "error", equipmentId: "W-GR-04", message: "Verbindung verloren, Fallback auf Simulation" }
     
     { type: "command_result", equipmentId: "W-GR-04", command: "tare", success: true, value: 0.523 }
     
     { type: "equipment_list", equipment: [...] }
     
     { type: "snapshot", equipmentId: "W-GR-04", parameters: [...with current values...] }

10. REST routes — server/routes/equipment.routes.js:

    Admin routes (auth + admin role):
    GET    /api/equipment                   → list all configs with online status
    GET    /api/equipment/types             → available types with default configs
    GET    /api/equipment/:id               → single config + status + live values
    POST   /api/equipment                   → create new equipment config
    PUT    /api/equipment/:id               → update config
    DELETE /api/equipment/:id               → delete (only if no weighing records reference it)
    POST   /api/equipment/:id/connect       → explicitly connect
    POST   /api/equipment/:id/disconnect    → explicitly disconnect
    POST   /api/equipment/:id/test          → 3-second connection test, returns sample values
    
    // NEW: Parameter discovery endpoints (used by LLM service for chat)
    GET    /api/equipment/:id/parameters    → list all process parameters with current values
    GET    /api/equipment/by-location/:loc  → equipment at a location
    GET    /api/equipment/by-type/:type     → all equipment of a type
    GET    /api/equipment/:id/snapshot      → full live snapshot of all parameter values

    Operator routes (auth required):
    GET    /api/equipment/:id/status        → connection status + basic info (no config details)

11. REST routes — server/routes/weighing.routes.js (auth required):
    POST   /api/weighing                    → save weighing record
    GET    /api/weighing                    → list (filter: pi_sheet_id, equipment_id, date, in_tolerance)
    GET    /api/weighing/:id                → single record (without raw_readings)
    GET    /api/weighing/:id/audit          → full record WITH raw_readings (GMP audit)
    PUT    /api/weighing/:id/verify         → 4-Augen verification by second user
    GET    /api/weighing/stats              → statistics: total, in_tolerance_pct, avg_deviation, by_equipment

12. Seed data:
    Create 3 default equipment configs:
    - W-GR-04: Mettler Toledo ICS689, scale, simulation, 50kg capacity, 0.001kg resolution, Gebäude 42 Linie VP-03
    - W-GR-05: Sartorius Entris II, scale, simulation, 10kg capacity, 0.01g resolution, Gebäude 42 Linie VP-03
    - T-GR-01: Endress+Hauser TMP-01, temperature, simulation, Gebäude 42 Granulation
    Each with full process_parameters arrays describing all available data points.

13. Wire up in server/index.js:
    - app.use('/api/equipment', equipmentRoutes)
    - app.use('/api/weighing', weighingRoutes)
    - Create WebSocket server on /ws/equipment attached to HTTP server
    - On server start: auto-connect all active equipment in simulation mode

Test plan:
- Server starts → 3 equipment auto-connected in simulation mode
- GET /api/equipment → 3 configs, all online
- GET /api/equipment/W-GR-04/parameters → list of 8 parameters with current values
- GET /api/equipment/W-GR-04/snapshot → live values
- WebSocket: subscribe W-GR-04 → receive 10Hz data → send tare → send addWeight 25.0 → values settle → confirm
- POST /api/weighing with confirmed data → record saved
- GET /api/weighing/:id/audit → raw readings array present
- POST /api/equipment/W-GR-04/test → returns 3s of sample data
```

---

## RUNDE 6 — Equipment Frontend: Waagen-Widget + Admin

```
Read .cursorrules and EQUIPMENT-SPEC.md frontend section. Build the interactive scale widget and equipment admin page.

1. client/src/composables/useEquipment.js — WebSocket composable:
   - connect(): open WS to ws://localhost:3000/ws/equipment with auth token
   - subscribe(equipmentId): send subscribe message, return reactive ref updated at 10Hz:
     ref({ grossWeight, netWeight, tareWeight, stable, unit, overload, status, timestamp, source })
   - unsubscribe(equipmentId)
   - sendCommand(equipmentId, command, params): send command, return promise resolving with result
   - getEquipmentList(): request and return equipment list
   - getSnapshot(equipmentId): request and return full parameter snapshot
   - Auto-reconnect on disconnect with 3s delay
   - Connection status as reactive ref: "connected" | "connecting" | "disconnected"

2. client/src/components/equipment/ScaleWidget.vue — THE MAIN COMPONENT:

   Props:
   - equipmentId: String (required)
   - targetWeight: Number (required)
   - tolerancePercent: Number (default 1.0)
   - toleranceAbs: Number (computed from target * percent if not given)
   - requiresTare: Boolean (default true)
   - requiresStable: Boolean (default true)
   - minStabilityMs: Number (default 2000)
   - fourEyes: Boolean (default false)
   - materialInfo: Object { number, name, batch }
   - readOnly: Boolean (default false, for print/review mode)

   Template structure:
   
   A) EQUIPMENT HEADER BAR:
   - Left: Equipment name "Mettler Toledo ICS689" + ID "W-GR-04"
   - Right: EquipmentConnectionBadge showing protocol + online status
   - If in fallback mode: yellow warning bar "Simulation — Waage W-GR-04 nicht erreichbar"

   B) MATERIAL INFO (if materialInfo provided):
   - Grid 2x2: Material-Nr | Charge | Sollmenge (target) kg | Toleranz ± X kg (Y%)

   C) SCALE LCD DISPLAY (dark background, monospace green text):
   - Top line small: equipment name + ID
   - Main area 3 columns:
     Left: "Tara" label + tare value (18px)
     Center: BIG weight display (42px) + "kg" unit + StabilityIndicator above
     Right: "Netto" label + net value (18px)
   - The displayed weight is grossWeight from WebSocket data
   - Update smoothly at 10Hz — use requestAnimationFrame to avoid flicker

   D) ACTION BUTTONS ROW:
   - "Tara" button: sends tare command via WS, disabled after confirmation
   - "Material zugeben" button: ONLY shown when source is "simulation", sends addWeight command
     After click: button disabled, shows "Dosierung..." until values stabilize
   - "Gewicht uebernehmen" button: initially disabled, enabled when:
     * requiresTare → tare must be set (tareWeight > 0)
     * requiresStable → stable must be true
     * minStabilityMs → stable for at least this duration
     On click: POST /api/weighing with all data, emit @weighing-confirmed
   
   E) TOLERANCE BAR (ToleranceBar.vue):
   - Horizontal bar showing range: [target - tolerance] ... [target] ... [target + tolerance]
   - Current net weight as a marker/indicator on the bar
   - Green zone: within tolerance
   - Red zone: outside tolerance
   - Only shown when net weight > 0

   F) RESULT CARD (WeighingResult.vue, shown after confirmation):
   - Grid: Sollmenge | Istmenge (colored green/red) | Abweichung | Bewertung badge
   - Tolerance bar (final position)
   - Signature fields: Eingewogen von ___ Datum ___ | Geprueft von ___ Datum ___
   - If fourEyes: "4-Augen Bestätigung" section with second user input
   - Timestamp of confirmation

   State management:
   - rawReadings: array collecting every WS data point from subscribe until confirm (for audit trail)
   - stabilityTimer: starts counting when stable=true, resets when stable=false
   - isTared: boolean, set after tare command succeeds
   - isConfirmed: boolean, prevents further interaction after confirmation

   Emits:
   - @weighing-confirmed: { weighingRecordId, netWeight, grossWeight, tareWeight, deviation, inTolerance }

3. Sub-components:

   client/src/components/equipment/ScaleDisplay.vue:
   - Props: gross, net, tare, unit, stable, equipmentName, equipmentId
   - Dark themed LCD display (bg: #0a1628, text: #4ade80, font: monospace)
   - Three-column layout: Tara | Main Weight | Netto
   - Numbers format to 3 decimal places, right-aligned

   client/src/components/equipment/ToleranceBar.vue:
   - Props: target, toleranceAbs, currentValue
   - Horizontal bar with colored zones
   - Arrow/marker showing current position
   - Labels: min, target, max values

   client/src/components/equipment/StabilityIndicator.vue:
   - Props: stable (boolean)
   - Shows "STABIL" in green or "INSTABIL" in yellow with blink animation
   - Small text, positioned above weight display

   client/src/components/equipment/WeighingResult.vue:
   - Props: result object from weighing confirmation
   - Result card with all values, deviation, assessment badge, signature fields
   - fourEyes mode: shows verification section

   client/src/components/equipment/EquipmentConnectionBadge.vue:
   - Props: connectionType, isOnline, isFallback
   - Small badge: icon + text
   - Simulation: yellow badge "SIM"
   - OPC UA: blue badge "OPC UA" + green/red dot
   - MQTT: purple badge "MQTT" + green/red dot
   - UNS: teal badge "UNS" + green/red dot
   - Fallback: yellow warning "SIM (Fallback)"

4. Integration into PISheetPreview.vue:

   When rendering step params, check param.type:
   - "input" → standard text input (existing)
   - "display" → read-only text (existing)
   - "checkbox" → checkbox (existing)
   - "scale" → render ScaleWidget component:
     <ScaleWidget
       :equipment-id="param.equipment_config.equipment_id"
       :target-weight="getStepParamValue(step, param.equipment_config.target_field)"
       :tolerance-percent="getStepParamValue(step, param.equipment_config.tolerance_field)"
       :requires-tare="param.equipment_config.requires_tare"
       :four-eyes="param.equipment_config.four_eyes"
       :material-info="getMaterialInfo(step)"
       :read-only="isPrintMode"
       @weighing-confirmed="onWeighingConfirmed(step, param, $event)"
     />
   
   In PRINT MODE (Offline-Ansicht):
   - ScaleWidget renders as a static table instead:
     | Sollmenge   | {target} kg          |
     | Toleranz    | ± {tol} kg ({pct}%)  |
     | Istmenge    | ______________ kg    |
     | Abweichung  | ______________ kg    |
     | In Toleranz | [ ] Ja  [ ] Nein     |
     | Waage-ID    | {equipmentId}        |
     | Eingewogen  | _______ Datum: _____ |
     | Geprueft    | _______ Datum: _____ |

   If weighing was already confirmed (has weighing record):
   - Print mode shows filled values instead of empty lines
   - Digital mode shows WeighingResult instead of active ScaleWidget

5. client/src/views/EquipmentView.vue — Admin Equipment Page:

   Add route /admin/equipment, add "Equipment" to admin sidebar with scale icon.

   TOP SECTION — Stats cards:
   - Konfigurierte Geräte: N
   - Online: N (green badge)
   - Offline: N (red badge)
   - Simulation: N (yellow badge)

   EQUIPMENT TABLE:
   - Columns: Equipment-ID, Name, Typ (icon by type), Verbindung (EquipmentConnectionBadge), Status (Online/Offline dot), Standort, Aktionen
   - Row click → expand details panel below row
   - Action buttons: Bearbeiten (pencil), Verbindung testen (plug), Löschen (trash)

   ADD/EDIT MODAL:
   Base fields:
   - Equipment-ID: text input (readonly on edit)
   - Name: text input
   - Typ: dropdown (Waage, Temperatur-Sensor, Barcode-Scanner, pH-Meter, Timer)
   - Standort: text input

   Connection type: radio button group with visual cards:
   ○ Simulation (default)
     → Shows: Update-Rate (ms), Noise (kg), Max. Gewicht (kg)
     → Info text: "Simuliert eine realistische Industriewaage ohne externe Hardware."
   
   ○ OPC UA
     → Shows: Endpoint URL, Node Prefix, Security Mode dropdown (None/Sign/SignAndEncrypt), Username, Password
     → Info text: "Direkte Anbindung an OPC UA Server der Waage oder SPS."
   
   ○ MQTT
     → Shows: Broker URL, Topic Prefix, QoS dropdown (0/1/2), Username, Password
     → Info text: "MQTT-basierte Anbindung über einen Message Broker."
   
   ○ UNS / Sparkplug B
     → Shows: Broker URL, Group ID, Edge Node ID, Device ID, Username, Password
     → Info text: "Unified Namespace mit Sparkplug B Protokoll (ISA-95 konform)."

   Scale config (when type = Waage):
   - Max. Kapazität (kg)
   - Auflösung (kg)
   - Einheit: dropdown (kg, g, mg)
   - Kalibrierungs-Intervall (Tage)
   - Letzte Kalibrierung: date picker

   "Verbindung testen" button:
   - Runs POST /api/equipment/:id/test
   - Shows spinner for 3 seconds
   - Result: green check "Verbunden — Aktueller Wert: 0.000 kg, Stabil: Ja"
   - Or: red X "Verbindung fehlgeschlagen: Connection refused"

   LIVE TEST PANEL (expandable per equipment in table):
   - Mini ScaleDisplay showing real-time data
   - Source indicator: "Daten von: Simulation"
   - Update rate counter: "10.2 Hz"
   - "Tara" test button
   - "Material zugeben (5 kg)" test button (simulation only)
   - "Reset" button

Test plan:
- /admin/equipment shows 3 seeded equipment items, all online in simulation
- Add new equipment → appears in table
- Edit connection type to OPC UA → fields appear → test → fails (no server) → graceful error
- Expand live test panel → see real-time simulated scale data
- Open PI Sheet with Einwaage step → ScaleWidget renders with live data
- Tara → Material zugeben → weight settles with realistic physics → Gewicht uebernehmen
- Result card shows → switch to print mode → static table with values
- Check /api/weighing → record saved with raw_readings
```

---

## RUNDE 7 — Chat-basierte Prozessparameter-Abfrage

```
Read .cursorrules and EQUIPMENT-SPEC.md. Extend the LLM service so Claude can discover and query equipment parameters through the chat.

The user should be able to ask things like:
- "Welche Waagen gibt es auf Linie VP-03?"
- "Was sind die Prozessparameter der Waage W-GR-04?"
- "Zeig mir den aktuellen Wert von W-GR-04"
- "Welche Sensoren haben wir in Gebäude 42?"
- "Erstelle ein PI Sheet für Einwaage mit der Waage W-GR-05"

Claude uses tool calling to access equipment data in real-time.

1. Define equipment tools for Claude API — server/services/llm.service.js:

   Add these tools to the Claude API call alongside the existing XStep search:

   Tool 1: list_equipment
   {
     name: "list_equipment",
     description: "List all configured equipment (scales, sensors, scanners) optionally filtered by type, location, or production line. Returns equipment ID, name, type, connection status, and location.",
     input_schema: {
       type: "object",
       properties: {
         equipment_type: { type: "string", enum: ["scale", "temperature", "barcode", "ph_meter", "timer", "all"], description: "Filter by equipment type" },
         location: { type: "string", description: "Filter by location or production line, e.g. 'VP-03' or 'Gebäude 42'" },
         online_only: { type: "boolean", default: false, description: "Only show currently online equipment" }
       }
     }
   }
   Implementation: call gateway.getEquipmentList(filters), format as readable text

   Tool 2: get_equipment_parameters
   {
     name: "get_equipment_parameters",
     description: "Get all available process parameters for a specific piece of equipment, including current live values. Use this to understand what data a scale, sensor, or other device can provide.",
     input_schema: {
       type: "object",
       properties: {
         equipment_id: { type: "string", description: "Equipment ID, e.g. 'W-GR-04'" }
       },
       required: ["equipment_id"]
     }
   }
   Implementation: call gateway.getEquipmentParameters(id) + gateway.getLiveSnapshot(id)
   Return: parameter list with current values, data types, units, descriptions

   Tool 3: read_equipment_value
   {
     name: "read_equipment_value",
     description: "Read the current live value from a specific equipment parameter. For example, read the current weight from a scale.",
     input_schema: {
       type: "object",
       properties: {
         equipment_id: { type: "string", description: "Equipment ID" },
         parameter_name: { type: "string", description: "Parameter name, e.g. 'NetWeight', 'GrossWeight', 'Stable', 'Temperature'" }
       },
       required: ["equipment_id"]
     }
   }
   Implementation: call gateway.getCurrentValue(id), return specific parameter or all if parameter_name not given

   Tool 4: get_equipment_config
   {
     name: "get_equipment_config",
     description: "Get the configuration details of a specific equipment including connection type (OPC UA, MQTT, UNS, Simulation), calibration info, capacity, and resolution.",
     input_schema: {
       type: "object",
       properties: {
         equipment_id: { type: "string", description: "Equipment ID" }
       },
       required: ["equipment_id"]
     }
   }
   Implementation: load EquipmentConfig from DB, return formatted config (without passwords)

2. Update the system prompt in PromptConfig to include equipment context:

   Add to the default system prompt:
   "Du hast Zugriff auf Equipment-Daten aus der Produktion (Waagen, Sensoren, Scanner).
   Nutze die Equipment-Tools um:
   - Verfügbare Geräte aufzulisten (list_equipment)
   - Prozessparameter eines Geräts abzufragen (get_equipment_parameters)  
   - Aktuelle Live-Werte zu lesen (read_equipment_value)
   - Gerätekonfigurationen zu prüfen (get_equipment_config)
   
   Wenn der User nach Geräten, Parametern oder Messwerten fragt, nutze die Tools.
   Wenn der User ein PI Sheet mit Equipment-Anbindung will, prüfe welche Geräte verfügbar sind
   und schlage den passenden equipment_config Block für den XStep-Parameter vor."

3. Handle tool use in the LLM service:

   The Claude API may return tool_use blocks. Implement the tool execution loop:
   
   async function handleToolUse(response, userId) {
     const toolResults = [];
     
     for (const block of response.content) {
       if (block.type === "tool_use") {
         let result;
         switch (block.name) {
           case "search_xstep_repository":
             result = await repositoryService.searchSimilar(block.input.query);
             break;
           case "list_equipment":
             result = await equipmentGateway.getEquipmentList(block.input);
             break;
           case "get_equipment_parameters":
             result = await equipmentGateway.getEquipmentParameters(block.input.equipment_id);
             break;
           case "read_equipment_value":
             result = await equipmentGateway.getCurrentValue(block.input.equipment_id);
             break;
           case "get_equipment_config":
             result = await getEquipmentConfigSafe(block.input.equipment_id); // without passwords
             break;
         }
         toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
       }
     }

     if (toolResults.length > 0) {
       // Continue conversation with tool results
       const followUp = await anthropic.messages.create({
         model: "claude-sonnet-4-20250514",
         max_tokens: 4000,
         system: systemPrompt,
         messages: [
           ...previousMessages,
           { role: "assistant", content: response.content },
           { role: "user", content: toolResults }
         ],
         tools: equipmentTools
       });
       
       // Recursively handle if Claude uses more tools
       if (followUp.content.some(b => b.type === "tool_use")) {
         return handleToolUse(followUp, userId);
       }
       return followUp;
     }
     
     return response;
   }

4. Enhanced PI Sheet generation with equipment:

   When Claude generates a PI Sheet and recognizes that equipment is involved:
   - It calls list_equipment to find available devices
   - It calls get_equipment_parameters to know what data the device provides
   - It generates the step param with type: "scale" and the correct equipment_config block
   
   Example: User says "PI Sheet für Einwaage von Lactose auf Linie VP-03"
   Claude:
   1. Calls search_xstep_repository("Einwaage Lactose")
   2. Calls list_equipment({ type: "scale", location: "VP-03" })
   3. Gets back: W-GR-04 and W-GR-05 available
   4. Calls get_equipment_parameters("W-GR-04") to check capacity
   5. Generates PI Sheet with scale widget configured for W-GR-04

5. Example chat interactions the system should handle:

   User: "Welche Waagen haben wir?"
   Claude: → calls list_equipment({ type: "scale" })
   → "Auf euren Linien sind 2 Waagen konfiguriert: W-GR-04 (Mettler Toledo, 50kg, Linie VP-03) und W-GR-05 (Sartorius, 10kg, Linie VP-03). Beide sind aktuell online im Simulationsmodus."

   User: "Was kann die W-GR-04 alles messen?"
   Claude: → calls get_equipment_parameters("W-GR-04")
   → "Die Waage W-GR-04 stellt folgende Prozessparameter bereit: Brutto-Gewicht (Float, kg), Netto-Gewicht (Float, kg), Tara (Float, kg), Stabilität (Boolean), Überlast-Warnung (Boolean), Status (0=OK/1=Error/2=Kalibrierung), Kalibrierungsdatum."

   User: "Was zeigt die Waage gerade an?"
   Claude: → calls read_equipment_value("W-GR-04")
   → "Aktuelle Werte W-GR-04: Brutto 0.000 kg, Netto 0.000 kg, Tara 0.000 kg, Stabil: Ja, Status: OK"

   User: "Erstelle ein PI Sheet für Einwaage von 25kg Lactose mit der Waage W-GR-04"
   Claude: → calls search_xstep_repository + get_equipment_parameters
   → Generates PI Sheet with ScaleWidget integrated in the Einwaage step

   User: "Wie ist die Waage W-GR-04 angebunden?"
   Claude: → calls get_equipment_config("W-GR-04")
   → "Die W-GR-04 läuft aktuell im Simulationsmodus (10Hz, ±0.002kg Noise). Kapazität: 50kg, Auflösung: 0.001kg. Letzte Kalibrierung: 01.12.2025, gültig bis 01.12.2026."

Test plan:
- Chat: "Welche Waagen gibt es?" → Claude calls list_equipment, returns formatted answer
- Chat: "Prozessparameter von W-GR-04" → Claude calls get_equipment_parameters, lists all
- Chat: "Aktueller Wert der Waage" → Claude calls read_equipment_value, shows live values
- Chat: "PI Sheet für Einwaage 25kg Lactose mit W-GR-04" → PI Sheet generated with ScaleWidget
- Chat: "Wie ist die Waage angebunden?" → Claude calls get_equipment_config, explains setup
- All tool calls are handled transparently — user just sees the natural language answer
```

---

## Zusammenfassung MVP 3.0

```
RUNDE 5 → Equipment Backend     (Gateway, Simulation, OPC UA, MQTT, UNS, WebSocket)
RUNDE 6 → Equipment Frontend    (ScaleWidget, LCD Display, Admin Page)
RUNDE 7 → Chat Parameter Query  (Claude kann Equipment abfragen und in PI Sheets einbauen)
```

---

## Gesamtübersicht aller Dateien

```
pi-sheet-generator/
├── .cursorrules
├── client/ · server/ · docker/
├── docs/
│   ├── DOCUMENTATION.md · DEV.md
│   ├── specs/          ← IMPORT, MVP2, MVP4, EQUIPMENT
│   └── playbooks/      ← mvp1/2/3-playbook.md (dieses File)
├── fixtures/           ← test-xsteps.csv, images/
└── ...
```

## Build-Reihenfolge gesamt

```
MVP 1.0  Steps 1-11    Basis: Chat → PI Sheet, Admin, Upload
MVP 2.0  Runden 1-4    Vision, Wissensbasis, SAP (optional)
MVP 3.0  Runden 5-7    Equipment, Waage, OPC UA/UNS, Chat-Parameter
```

---

## Quick-Test nach MVP 3.0

```bash
# 1. Server starten
docker-compose up -d
cd server && npm run dev
# → "3 Equipment auto-connected (simulation)"

# 2. Frontend starten  
cd client && npm run dev

# 3. Test Equipment Admin
# → /admin/equipment: 3 Geräte, alle online (Simulation)
# → Live Test Panel aufklappen: Echtzeit-Daten von simulierter Waage
# → Neues Equipment anlegen mit OPC UA Config → Test → Fallback auf Simulation

# 4. Test Waage im PI Sheet
# → Chat: "PI Sheet für Einwaage 25kg Lactose mit Waage W-GR-04"
# → PI Sheet mit integriertem ScaleWidget
# → Tara → Material zugeben → Gewicht stabilisiert → Übernehmen → Ergebnis mit Signaturfeldern
# → Druck-Ansicht: statische Tabelle mit Werten

# 5. Test Chat Parameter-Abfrage
# → "Welche Waagen gibt es auf Linie VP-03?"
# → "Was sind die Parameter von W-GR-04?"
# → "Was zeigt die Waage gerade an?"
# → Claude antwortet mit echten Live-Daten aus der Simulation

# 6. Test GMP Audit
# → GET /api/weighing → Wägungshistorie
# → GET /api/weighing/:id/audit → Raw Readings (jeder 100ms Messwert)
```
