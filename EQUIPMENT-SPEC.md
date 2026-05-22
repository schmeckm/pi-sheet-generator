# PI Sheet Generator — Equipment Integration Spec

> **Waagen-Anbindung über OPC UA / UNS mit Simulation für den Pilot**
> Lege diese Datei als `EQUIPMENT-SPEC.md` ins Projekt-Root.

---

## Übersicht

XSteps können Equipment-Parameter enthalten (Waage, Temperatur-Sensor, Barcode-Scanner etc.). Diese kommunizieren über standardisierte Protokolle:

```
┌──────────────────────────────────────────────────────────────────────┐
│  PI Sheet Generator                                                   │
│                                                                        │
│  ┌────────────┐     ┌──────────────────┐     ┌────────────────────┐  │
│  │ Frontend    │◄───▶│ Equipment Gateway │◄───▶│ Protokoll-Layer    │  │
│  │ (Vue 3)    │ WS  │ (Node.js)        │     │                    │  │
│  │            │     │                  │     │  ┌──────────────┐  │  │
│  │ Waagen-UI  │     │ - Session Mgmt   │     │  │ OPC UA Client│  │  │
│  │ Sensor-UI  │     │ - Data Buffer    │     │  └──────┬───────┘  │  │
│  │ Scanner-UI │     │ - Simulation     │     │         │          │  │
│  │            │     │ - Value Mapping  │     │  ┌──────▼───────┐  │  │
│  └────────────┘     │                  │     │  │ MQTT Client  │  │  │
│                     │  Admin:          │     │  │ (UNS/Sparkplug)│ │  │
│                     │  - Config        │     │  └──────┬───────┘  │  │
│                     │  - Simulation    │     │         │          │  │
│                     │  - Mapping       │     │  ┌──────▼───────┐  │  │
│                     └──────────────────┘     │  │ Simulator    │  │  │
│                                              │  │ (Default)    │  │  │
│                                              │  └──────────────┘  │  │
│                                              └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

Externe Systeme (echte Hardware):

  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐
  │ Mettler     │    │ MQTT Broker  │    │ OPC UA Server      │
  │ Toledo      │    │ (Mosquitto/  │    │ (Waage / SPS /     │
  │ ICS689      │    │  HiveMQ /    │    │  Kepware)          │
  │             │    │  UNS)        │    │                    │
  └─────────────┘    └──────────────┘    └────────────────────┘
```

## Kommunikationsprotokolle

### 1. OPC UA (Open Platform Communications Unified Architecture)

Standard in der Pharma-/Fertigungsindustrie. Jede Waage hat einen OPC UA Server mit Nodes:

```
OPC UA Node Structure (typisch für Waage):
─────────────────────────────────────────
ns=2;s=Scale.W-GR-04                     ← Waagen-Root-Node
  ├── ns=2;s=Scale.W-GR-04.GrossWeight   ← Brutto-Gewicht (Float, kg)
  ├── ns=2;s=Scale.W-GR-04.NetWeight     ← Netto-Gewicht (Float, kg)
  ├── ns=2;s=Scale.W-GR-04.TareWeight    ← Tara-Gewicht (Float, kg)
  ├── ns=2;s=Scale.W-GR-04.Unit          ← Einheit (String: "kg")
  ├── ns=2;s=Scale.W-GR-04.Stable        ← Stabiler Messwert (Boolean)
  ├── ns=2;s=Scale.W-GR-04.Overload      ← Überlast (Boolean)
  ├── ns=2;s=Scale.W-GR-04.Status        ← Status (Int: 0=OK, 1=Error, 2=Cal)
  ├── ns=2;s=Scale.W-GR-04.CalibrationDate ← Letzte Kalibrierung (DateTime)
  └── ns=2;s=Scale.W-GR-04.Tare()        ← Method: Tara auslösen
```

### 2. UNS / MQTT Sparkplug B (Unified Namespace)

Moderner ISA-95-konformer Ansatz. Equipment publiziert Daten in eine Topic-Hierarchie:

```
UNS Topic Structure (Sparkplug B):
──────────────────────────────────
spBv1.0/
  └── Pharma/
      └── Basel/
          └── Building42/
              └── Line-VP-03/
                  └── Weighing/
                      └── W-GR-04/
                          ├── DBIRTH     ← Device Birth (Metadata)
                          ├── DDATA      ← Device Data (Messwerte)
                          │   ├── GrossWeight: 25.142 (Float)
                          │   ├── NetWeight: 25.142 (Float)
                          │   ├── TareWeight: 0.000 (Float)
                          │   ├── Stable: true (Boolean)
                          │   ├── Unit: "kg" (String)
                          │   └── Timestamp: 1716393600000 (ms)
                          ├── DDEATH     ← Device Death (Offline)
                          └── DCMD       ← Device Command (Tara etc.)

Alternative: Flat MQTT (ohne Sparkplug):
────────────────────────────────────────
pharma/basel/line-vp-03/scale/w-gr-04/gross_weight    → 25.142
pharma/basel/line-vp-03/scale/w-gr-04/net_weight      → 25.142
pharma/basel/line-vp-03/scale/w-gr-04/tare_weight     → 0.000
pharma/basel/line-vp-03/scale/w-gr-04/stable          → true
pharma/basel/line-vp-03/scale/w-gr-04/cmd/tare        ← Subscribe for commands
```

### 3. Simulation (Default für Pilot)

Kein externer Server nötig. Der Equipment Gateway simuliert eine realistische Waage intern:

```
Simulation Parameters:
- Update-Rate: 100ms (10 Hz, wie echte Industriewaage)
- Noise: ±0.002 kg (normaler Messjitter)
- Drift: ±0.001 kg/s bei instabilem Zustand
- Stabilisierungszeit: 2-4 Sekunden nach Materialzugabe
- Einschwingverhalten: Exponentiell mit leichtem Überschwinger
- Tara-Genauigkeit: 0.001 kg
- Overload: bei > 50 kg (abhängig von Waagen-Config)
```

---

## Datenbank-Erweiterungen

### Equipment-Konfiguration

```sql
CREATE TABLE equipment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id VARCHAR(50) UNIQUE NOT NULL,     -- z.B. "W-GR-04"
  name VARCHAR(255) NOT NULL,                    -- z.B. "Mettler Toledo ICS689"
  equipment_type VARCHAR(50) NOT NULL,           -- "scale" | "temperature" | "barcode" | "ph_meter" | "timer"
  location VARCHAR(255),                         -- z.B. "Gebäude 42, Linie VP-03"
  
  -- Verbindung
  connection_type VARCHAR(50) DEFAULT 'simulation',  -- "simulation" | "opcua" | "mqtt" | "uns_sparkplug"
  connection_config JSONB DEFAULT '{}',
  -- OPC UA: { "endpoint": "opc.tcp://192.168.1.100:4840", "nodePrefix": "ns=2;s=Scale.W-GR-04", "securityMode": "None" }
  -- MQTT:   { "broker": "mqtt://192.168.1.50:1883", "topicPrefix": "pharma/basel/line-vp-03/scale/w-gr-04", "qos": 1 }
  -- UNS:    { "broker": "mqtt://uns-broker:1883", "groupId": "Pharma", "edgeNodeId": "Basel/Building42/Line-VP-03", "deviceId": "W-GR-04" }
  -- Simulation: { "updateRate": 100, "noise": 0.002, "maxWeight": 50.0, "resolution": 0.001 }
  
  -- Waagen-spezifisch
  scale_config JSONB DEFAULT '{}',
  -- { "maxCapacity": 50.0, "resolution": 0.001, "unit": "kg", "calibrationInterval": 365, "lastCalibration": "2025-12-01" }
  
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Waage-Messungen (Audit Trail für GMP)
CREATE TABLE weighing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_sheet_id UUID REFERENCES pi_sheets(id),
  pi_sheet_step_id UUID REFERENCES pi_sheet_steps(id),
  equipment_id VARCHAR(50) REFERENCES equipment_configs(equipment_id),
  
  -- Messwerte
  gross_weight DECIMAL(10,3),
  tare_weight DECIMAL(10,3),
  net_weight DECIMAL(10,3),
  unit VARCHAR(10) DEFAULT 'kg',
  
  -- Soll/Ist
  target_weight DECIMAL(10,3),
  tolerance_abs DECIMAL(10,3),
  tolerance_pct DECIMAL(5,2),
  deviation DECIMAL(10,3),
  in_tolerance BOOLEAN,
  
  -- Material
  material_number VARCHAR(50),
  material_name VARCHAR(255),
  batch_number VARCHAR(50),
  
  -- Stabilität & Qualität
  stable_reading BOOLEAN DEFAULT true,
  reading_count INTEGER,                         -- Anzahl Messwerte vor Übernahme
  stability_duration_ms INTEGER,                 -- Wie lange war Wert stabil
  
  -- Signatur
  weighed_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  weighed_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  
  -- Raw Data für Audit
  raw_readings JSONB,                            -- [{timestamp, gross, net, stable}, ...]
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### XStep Parameter-Typ Erweiterung

```sql
-- Bestehende params JSONB in xsteps bekommt neue Typen:
-- Bisherig: "input" | "display" | "checkbox"
-- Neu:      "scale" | "temperature" | "barcode" | "ph_meter" | "timer"

-- Beispiel XStep mit Waagen-Anbindung:
{
  "xstep_id": "XS-GR-001",
  "name": "Rohstoff-Einwaage",
  "params": [
    { "name": "Material-Nr.", "type": "display", "required": true },
    { "name": "Charge", "type": "input", "required": true },
    { "name": "Sollmenge", "type": "display", "unit": "kg", "required": true },
    { "name": "Toleranz", "type": "display", "unit": "%" },
    {
      "name": "Einwaage",
      "type": "scale",
      "required": true,
      "equipment_config": {
        "equipment_id": "W-GR-04",
        "target_field": "Sollmenge",
        "tolerance_field": "Toleranz",
        "requires_tare": true,
        "requires_stable": true,
        "min_stability_ms": 2000,
        "four_eyes": true,
        "record_raw_data": true
      }
    },
    { "name": "Waage-ID", "type": "display" },
    { "name": "Kalibrierung bestätigt", "type": "checkbox", "required": true }
  ]
}
```

---

## Backend: Equipment Gateway Service

### Neue Dependencies

```bash
cd server
npm install node-opcua mqtt sparkplug-client ws
```

- `node-opcua` — OPC UA Client für industrielle Waagen/SPS
- `mqtt` — MQTT Client für UNS/Sparkplug
- `sparkplug-client` — Sparkplug B Encoding/Decoding
- `ws` — WebSocket Server für Frontend-Kommunikation

### Projektstruktur Erweiterung

```
server/
├── services/
│   ├── equipment/
│   │   ├── gateway.service.js         # Haupt-Gateway: verwaltet alle Equipment-Verbindungen
│   │   ├── simulator.service.js       # Waagen-/Sensor-Simulation
│   │   ├── opcua.connector.js         # OPC UA Client
│   │   ├── mqtt.connector.js          # Plain MQTT Client
│   │   ├── sparkplug.connector.js     # UNS Sparkplug B Client
│   │   └── weighing.service.js        # Einwaage-Logik (Toleranz, 4-Augen, Audit)
│   └── ...
├── routes/
│   ├── equipment.routes.js            # REST API für Config + History
│   └── ...
└── websocket/
    └── equipment.ws.js                # WebSocket Handler für Live-Daten
```

### gateway.service.js — Haupt-Equipment-Gateway

```
Der Gateway Service ist der zentrale Hub für alle Equipment-Verbindungen.
Er abstrahiert das Protokoll — das Frontend spricht immer dasselbe Interface,
egal ob OPC UA, MQTT, UNS oder Simulation dahinter liegt.

VERANTWORTLICHKEITEN:
1. Equipment-Verbindungen verwalten (connect, disconnect, status)
2. Daten empfangen von allen Quellen und normalisieren
3. Live-Daten per WebSocket an Frontend streamen
4. Kommandos (Tara, Zero) an Equipment senden
5. Automatischer Fallback auf Simulation wenn Verbindung fehlschlägt

INTERFACE (gleich für alle Protokolle):
  connect(equipmentId) → { success, status }
  disconnect(equipmentId)
  subscribe(equipmentId, callback) → unsubscribe function
  sendCommand(equipmentId, command, params) → { success }
  getStatus(equipmentId) → { online, lastValue, lastSeen }
  getCurrentValue(equipmentId) → { gross, net, tare, stable, unit, timestamp }

NORMALISIERTES DATENFORMAT (von allen Quellen):
{
  equipmentId: "W-GR-04",
  equipmentType: "scale",
  timestamp: 1716393600000,
  values: {
    grossWeight: 25.142,
    netWeight: 25.142,
    tareWeight: 0.000,
    stable: true,
    unit: "kg",
    overload: false,
    status: 0  // 0=OK, 1=Error, 2=Calibrating
  },
  source: "simulation" | "opcua" | "mqtt" | "uns"
}

VERBINDUNGSLOGIK:
  1. Lade EquipmentConfig aus DB
  2. Basierend auf connection_type:
     - "simulation" → starte simulator.service
     - "opcua" → verbinde opcua.connector
     - "mqtt" → verbinde mqtt.connector
     - "uns_sparkplug" → verbinde sparkplug.connector
  3. Bei Verbindungsfehler (opcua/mqtt/uns):
     - Log Warnung
     - Automatisch Fallback auf Simulation
     - Markiere in Frontend: "⚠ Simulation — Waage nicht erreichbar"
  4. Normalisiere eingehende Daten ins einheitliche Format
  5. Pushe via WebSocket an alle subscribed Clients
```

### simulator.service.js — Realistische Waagen-Simulation

```
Die Simulation muss sich wie eine echte Industriewaage verhalten,
damit der Pilot überzeugend ist und Operator den Workflow realitätsnah testen können.

SIMULATION ENGINE:

class ScaleSimulator {
  constructor(config) {
    this.maxCapacity = config.maxCapacity || 50.0;    // kg
    this.resolution = config.resolution || 0.001;      // kg
    this.noise = config.noise || 0.002;                // kg (Messjitter)
    this.updateRate = config.updateRate || 100;         // ms
    this.currentGross = 0;
    this.currentTare = 0;
    this.targetWeight = null;
    this.stable = true;
    this.stabilityCounter = 0;
    this.settling = false;
    this.settlingTarget = 0;
    this.settlingProgress = 0;
  }

  // Wird alle updateRate ms aufgerufen
  tick() {
    if (this.settling) {
      // Einschwingverhalten: exponentiell mit leichtem Überschwinger
      this.settlingProgress += 1;
      const t = this.settlingProgress / (3000 / this.updateRate); // ~3 Sekunden
      
      if (t < 1.0) {
        // Overshoot: Gewicht schwingt kurz über Zielwert
        const overshoot = 1.0 + 0.03 * Math.sin(t * Math.PI * 3) * (1 - t);
        const approach = 1 - Math.pow(1 - t, 2.5);
        this.currentGross = this.currentTare + this.settlingTarget * approach * overshoot;
        this.stable = false;
      } else {
        // Stabil: nur noch Noise
        this.currentGross = this.currentTare + this.settlingTarget;
        this.settling = false;
        this.stable = false; // Stabilität nach stabilityCounter
        this.stabilityCounter = 0;
      }
    }

    // Noise hinzufügen (Gauss-verteilt)
    const gaussNoise = this.gaussRandom() * this.noise;
    const displayGross = this.currentGross + gaussNoise;
    
    // Auf Auflösung runden
    const roundedGross = Math.round(displayGross / this.resolution) * this.resolution;
    
    // Stabilität prüfen (stabil = Wert ändert sich nicht mehr als 1 digit)
    if (!this.settling) {
      this.stabilityCounter++;
      if (this.stabilityCounter > (2000 / this.updateRate)) { // 2 Sekunden stabil
        this.stable = true;
      }
    }

    const net = roundedGross - this.currentTare;
    
    return {
      grossWeight: Math.max(0, roundedGross),
      netWeight: Math.max(0, net),
      tareWeight: this.currentTare,
      stable: this.stable,
      unit: "kg",
      overload: roundedGross > this.maxCapacity,
      status: roundedGross > this.maxCapacity ? 1 : 0
    };
  }

  // Tara setzen
  tare() {
    this.currentTare = this.currentGross;
    this.stable = true;
    return this.currentTare;
  }

  // Material zugeben (simuliert Dosierung)
  addWeight(amount) {
    this.settling = true;
    this.settlingTarget = amount;
    this.settlingProgress = 0;
    this.stable = false;
    this.stabilityCounter = 0;
  }

  // Alles zurücksetzen
  reset() {
    this.currentGross = 0;
    this.currentTare = 0;
    this.stable = true;
    this.settling = false;
  }

  // Box-Muller für Gauss-Noise
  gaussRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
```

### opcua.connector.js — OPC UA Client

```
OPC UA Connector für echte Industriewaagen.

VERBINDUNG:
  const { OPCUAClient, AttributeIds, DataType } = require("node-opcua");

  class OPCUAConnector {
    constructor(config) {
      // config: { endpoint, nodePrefix, securityMode, username, password }
      this.client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: config.securityMode || "None",
        securityPolicy: config.securityPolicy || "None"
      });
      this.endpoint = config.endpoint;  // "opc.tcp://192.168.1.100:4840"
      this.nodePrefix = config.nodePrefix; // "ns=2;s=Scale.W-GR-04"
    }

    async connect() {
      await this.client.connect(this.endpoint);
      this.session = await this.client.createSession({
        userName: this.config.username,
        password: this.config.password
      });
    }

    // Subscription für Live-Daten
    async subscribe(callback) {
      const subscription = await this.session.createSubscription2({
        requestedPublishingInterval: 100,  // 100ms
        requestedMaxKeepAliveCount: 10,
        publishingEnabled: true
      });

      const nodes = ['GrossWeight', 'NetWeight', 'TareWeight', 'Stable', 'Status'];
      for (const node of nodes) {
        const monitoredItem = await subscription.monitor({
          nodeId: `${this.nodePrefix}.${node}`,
          attributeId: AttributeIds.Value
        }, { samplingInterval: 100 });

        monitoredItem.on("changed", (dataValue) => {
          callback(node, dataValue.value.value, dataValue.serverTimestamp);
        });
      }
    }

    // Tara als OPC UA Method Call
    async tare() {
      const methodId = `${this.nodePrefix}.Tare`;
      const objectId = this.nodePrefix;
      const result = await this.session.call({
        objectId, methodId, inputArguments: []
      });
      return result.statusCode.isGood();
    }

    // Einzelwert lesen
    async readValue(nodeName) {
      const nodeId = `${this.nodePrefix}.${nodeName}`;
      const dataValue = await this.session.read({ nodeId, attributeId: AttributeIds.Value });
      return dataValue.value.value;
    }

    async disconnect() {
      await this.session?.close();
      await this.client?.disconnect();
    }
  }
```

### mqtt.connector.js — Plain MQTT Client

```
MQTT Connector für einfache MQTT-basierte Equipment-Anbindung.

  const mqtt = require("mqtt");

  class MQTTConnector {
    constructor(config) {
      // config: { broker, topicPrefix, qos, username, password }
      this.broker = config.broker;       // "mqtt://192.168.1.50:1883"
      this.prefix = config.topicPrefix;  // "pharma/basel/line-vp-03/scale/w-gr-04"
      this.qos = config.qos || 1;
    }

    async connect() {
      this.client = mqtt.connect(this.broker, {
        username: this.config.username,
        password: this.config.password,
        clean: true,
        reconnectPeriod: 5000
      });

      return new Promise((resolve, reject) => {
        this.client.on("connect", () => resolve());
        this.client.on("error", (err) => reject(err));
      });
    }

    subscribe(callback) {
      // Subscribe to all sub-topics
      this.client.subscribe(`${this.prefix}/#`, { qos: this.qos });

      this.client.on("message", (topic, message) => {
        const field = topic.replace(`${this.prefix}/`, "");
        const value = this.parseValue(message.toString());
        callback(field, value, Date.now());
      });
    }

    // Tara-Befehl senden
    async tare() {
      this.client.publish(`${this.prefix}/cmd/tare`, "1", { qos: 1 });
    }

    parseValue(raw) {
      if (raw === "true") return true;
      if (raw === "false") return false;
      const num = parseFloat(raw);
      return isNaN(num) ? raw : num;
    }

    async disconnect() {
      this.client?.end();
    }
  }
```

### sparkplug.connector.js — UNS Sparkplug B Client

```
Sparkplug B Connector für Unified Namespace.

  const sparkplug = require("sparkplug-client");

  class SparkplugConnector {
    constructor(config) {
      // config: { broker, groupId, edgeNodeId, deviceId, username, password }
      this.config = config;
    }

    async connect() {
      this.client = sparkplug.newClient({
        serverUrl: this.config.broker,      // "tcp://uns-broker:1883"
        groupId: this.config.groupId,        // "Pharma"
        edgeNode: this.config.edgeNodeId,    // "Basel/Building42/Line-VP-03"
        clientId: `pisheet-${Date.now()}`,
        username: this.config.username,
        password: this.config.password
      });

      return new Promise((resolve) => {
        this.client.on("connect", () => resolve());
      });
    }

    subscribe(callback) {
      const deviceId = this.config.deviceId;  // "W-GR-04"

      this.client.on("message", (topic, payload) => {
        // Sparkplug B DDATA Message
        if (payload.metrics) {
          for (const metric of payload.metrics) {
            callback(metric.name, metric.value, metric.timestamp || Date.now());
          }
        }
      });

      // Subscribe to device data
      this.client.on("ddata", (deviceId, payload) => {
        for (const metric of payload.metrics) {
          callback(metric.name, metric.value, metric.timestamp);
        }
      });
    }

    async tare() {
      // Send DCMD (Device Command)
      this.client.publishDeviceCommand(
        this.config.deviceId,
        { metrics: [{ name: "Tare", value: true, type: "Boolean" }] }
      );
    }

    async disconnect() {
      this.client?.stop();
    }
  }
```

### WebSocket Handler — Live-Daten zum Frontend

```
server/websocket/equipment.ws.js

Der WebSocket Server streamt Equipment-Daten live ans Frontend.
Jeder Client subscribed auf ein oder mehrere Equipment-IDs.

PROTOCOL:

Client → Server:
  { action: "subscribe", equipmentId: "W-GR-04" }
  { action: "unsubscribe", equipmentId: "W-GR-04" }
  { action: "command", equipmentId: "W-GR-04", command: "tare" }
  { action: "command", equipmentId: "W-GR-04", command: "addWeight", params: { amount: 25.0 } }
  { action: "command", equipmentId: "W-GR-04", command: "reset" }

Server → Client:
  { type: "data", equipmentId: "W-GR-04", values: { grossWeight, netWeight, tareWeight, stable, unit, overload, status }, timestamp, source: "simulation" }
  { type: "status", equipmentId: "W-GR-04", online: true, source: "opcua" }
  { type: "error", equipmentId: "W-GR-04", message: "Verbindung verloren, Fallback auf Simulation" }
  { type: "command_result", equipmentId: "W-GR-04", command: "tare", success: true }

SETUP in server/index.js:
  const { WebSocketServer } = require("ws");
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/equipment" });
  // Pass wss to equipment gateway
```

---

## API Endpoints

### Equipment Configuration (Admin only)

```
GET    /api/equipment                    → Liste aller Equipment-Configs
GET    /api/equipment/:id                → Einzelne Config + Status
POST   /api/equipment                    → Neue Equipment-Config anlegen
PUT    /api/equipment/:id                → Config aktualisieren
DELETE /api/equipment/:id                → Löschen

POST   /api/equipment/:id/connect        → Verbindung herstellen
POST   /api/equipment/:id/disconnect     → Verbindung trennen
GET    /api/equipment/:id/status          → Live-Status { online, lastValue, source }
POST   /api/equipment/:id/test            → Verbindungstest (3 Sekunden, gibt Sample-Werte zurück)

GET    /api/equipment/types               → Verfügbare Equipment-Typen mit Default-Configs
```

### Weighing Records (Audit Trail)

```
GET    /api/weighing                      → Liste aller Wägungen, filter by pi_sheet_id, equipment_id, date
GET    /api/weighing/:id                  → Einzelne Wägung mit Raw Data
POST   /api/weighing                      → Wägung speichern (nach "Gewicht übernehmen")
PUT    /api/weighing/:id/verify           → 4-Augen-Prinzip: zweite Person bestätigt
GET    /api/weighing/:id/audit            → Audit Trail: alle Raw Readings + Timestamps
```

---

## Frontend: Equipment-Komponenten

### Neue Vue-Komponenten

```
client/src/components/equipment/
├── ScaleWidget.vue                 # Waagen-Anzeige mit Live-Daten
├── ScaleDisplay.vue                # LCD-ähnliches Gewichts-Display
├── ToleranceBar.vue                # Toleranz-Visualisierung (Soll vs Ist)
├── StabilityIndicator.vue          # Stabil/Instabil Anzeige
├── WeighingResult.vue              # Ergebnis nach Übernahme mit Signaturfeldern
├── EquipmentStatus.vue             # Online/Offline/Simulation Badge
└── EquipmentConnectionBadge.vue    # OPC UA / MQTT / UNS / Simulation Indikator
```

### ScaleWidget.vue — Hauptkomponente

```
Props:
  - equipmentId: String ("W-GR-04")
  - targetWeight: Number (25.0)
  - tolerancePercent: Number (1.0)
  - toleranceAbs: Number (0.25) 
  - requiresTare: Boolean (true)
  - requiresStable: Boolean (true)
  - minStabilityMs: Number (2000)
  - fourEyes: Boolean (true)
  - materialInfo: Object ({ number, name, batch })
  - readOnly: Boolean (false, for print/review mode)

State:
  - wsConnection: WebSocket to /ws/equipment
  - currentValues: { gross, net, tare, stable, unit, overload }
  - isTared: Boolean
  - isConfirmed: Boolean
  - rawReadings: Array (für Audit Trail)
  - stabilityTimer: Timer (zählt ms seit letzter Änderung)

Emits:
  - @weighing-confirmed: { netWeight, grossWeight, tareWeight, inTolerance, rawReadings, stableDuration }
  - @tare-set: { tareWeight }
  - @error: { message }

WebSocket Lifecycle:
  onMounted → connect WS → subscribe(equipmentId) → receive live data
  onUnmounted → unsubscribe → close WS

Template Layout:
  1. Equipment Header: Name, ID, Connection Badge (Simulation/OPC UA/MQTT/UNS), Online/Offline
  2. Material Info: Material-Nr, Charge, Sollmenge, Toleranz
  3. Scale Display (LCD): Brutto | Netto | Tara, Stability Indicator
  4. Action Buttons: Tara | (Material zugeben — nur in Simulation) | Gewicht übernehmen
  5. Tolerance Bar: visueller Vergleich Soll vs Ist
  6. Result Card (nach Übernahme): Ist, Abweichung, Bewertung, Signaturfelder, Timestamp
```

---

## Admin: Equipment-Verwaltung

### EquipmentView.vue — /admin/equipment

```
Neue Admin-Seite für Equipment-Konfiguration.

TOP: Stats
- Konfigurierte Geräte: N
- Online: N (grün)
- Offline: N (rot)  
- Simulation: N (gelb)

EQUIPMENT TABLE:
- Columns: Equipment-ID, Name, Typ (Icon), Verbindung (Badge: Simulation/OPC UA/MQTT/UNS), Status (Online/Offline), Standort, Aktionen
- Status Badge: 🟢 Online | 🔴 Offline | 🟡 Simulation | 🔄 Verbindung...
- Connection Badge: Shows protocol type with colored indicator

ADD/EDIT EQUIPMENT FORM (Modal):
  Basis-Felder:
  - Equipment-ID: z.B. "W-GR-04"
  - Name: z.B. "Mettler Toledo ICS689"
  - Typ: Dropdown (Waage, Temperatur-Sensor, Barcode-Scanner, pH-Meter, Timer)
  - Standort: z.B. "Gebäude 42, Linie VP-03"
  
  Verbindungs-Typ: Radio Buttons
  ○ Simulation (Standard) — keine weitere Konfiguration nötig
  ○ OPC UA — zeigt:
    - Endpoint URL: opc.tcp://...
    - Node Prefix: ns=2;s=Scale.W-GR-04
    - Security Mode: Dropdown (None, Sign, SignAndEncrypt)
    - Username / Password (optional)
  ○ MQTT — zeigt:
    - Broker URL: mqtt://...
    - Topic Prefix: pharma/basel/...
    - QoS: Dropdown (0, 1, 2)
    - Username / Password (optional)
  ○ UNS (Sparkplug B) — zeigt:
    - Broker URL: mqtt://...
    - Group ID: z.B. "Pharma"
    - Edge Node ID: z.B. "Basel/Building42/Line-VP-03"
    - Device ID: z.B. "W-GR-04"
    - Username / Password (optional)

  Waagen-Konfiguration (wenn Typ = Waage):
  - Max. Kapazität: 50.0 kg
  - Auflösung: 0.001 kg
  - Einheit: kg / g / mg
  - Kalibrierungs-Intervall: 365 Tage
  - Letzte Kalibrierung: Datum

  "Verbindung testen" Button:
  - Versucht 3 Sekunden lang eine Verbindung
  - Zeigt: ✅ "Verbunden — Aktueller Wert: 0.000 kg" oder ❌ "Verbindung fehlgeschlagen: [Fehler]"
  
  Simulations-Konfiguration (wenn Typ = Simulation):
  - Update-Rate: 100 ms
  - Noise-Level: 0.002 kg
  - Max. Gewicht: 50.0 kg

LIVE TEST PANEL (aufklappbar pro Equipment):
  - Mini-Waagen-Display das Live-Daten zeigt
  - Quelle anzeigen: "Daten von: Simulation / OPC UA / MQTT / UNS"
  - Update-Rate-Counter: "10.2 Hz"
  - "Tara" Test-Button
```

---

## Erweiterter XStep-Typ: Equipment-Parameter

### Wie es im PI Sheet erscheint

```
Wenn ein XStep einen Parameter mit type: "scale" hat:

DIGITAL-ANSICHT:
  → Rendert das volle ScaleWidget (Live-Display, Tara, Toleranz, Übernahme)
  → Operator interagiert direkt mit der Waage im PI Sheet

DRUCK-ANSICHT:
  → Rendert als Tabelle:
    | Sollmenge     | 25.000 kg        |
    | Toleranz      | ± 0.250 kg (1%)  |
    | Istmenge      | _____________ kg |
    | Abweichung    | _____________ kg |
    | In Toleranz   | ☐ Ja  ☐ Nein    |
    | Waage-ID      | W-GR-04          |
    | Eingewogen    | _______ Datum: _______ |
    | Geprüft       | _______ Datum: _______ |

PDF-EXPORT:
  → Wenn Wägung bereits durchgeführt: Werte eingetragen
  → Wenn nicht: leere Felder wie in Druck-Ansicht
```

---

## Weitere Equipment-Typen (Zukunft)

```
TEMPERATURE SENSOR (type: "temperature"):
  - Live-Temperatur-Anzeige
  - Min/Max Grenzwerte mit Alarm
  - Verlaufsgraph (letzte 30 Minuten)
  - OPC UA Node: ns=2;s=Sensor.T-01.Temperature
  - MQTT Topic: .../sensor/t-01/temperature

BARCODE SCANNER (type: "barcode"):
  - Scan-Eingabe (Kamera oder Hardware-Scanner)
  - Validierung gegen Material-/Chargennummer
  - OPC UA: ns=2;s=Scanner.BC-01.LastScan
  - MQTT: .../scanner/bc-01/scan

PH METER (type: "ph_meter"):
  - Live pH-Wert Anzeige
  - Soll-Bereich mit Toleranz
  - OPC UA: ns=2;s=PHMeter.PH-01.Value
  - MQTT: .../ph/ph-01/value

TIMER (type: "timer"):
  - Countdown/Countup Timer
  - Mindesthaltezeit
  - Alarm bei Ablauf
  - Keine externe Verbindung nötig
```

---

## Cursor Prompts

### Equipment Backend

```
Read .cursorrules and EQUIPMENT-SPEC.md. Add equipment integration with OPC UA, MQTT, UNS support and scale simulation.

1. Install: npm install node-opcua mqtt sparkplug-client ws

2. New Sequelize models:
   - server/models/EquipmentConfig.js (equipment_id, name, type, connection_type, connection_config JSONB, scale_config JSONB, is_active, is_online, last_seen)
   - server/models/WeighingRecord.js (pi_sheet_id, pi_sheet_step_id, equipment_id, gross/tare/net weight, target, tolerance, deviation, in_tolerance, material info, weighed_by, verified_by, raw_readings JSONB)

3. Equipment services:
   - server/services/equipment/gateway.service.js — central hub managing all connections, routes to correct connector based on connection_type, normalizes data format, auto-fallback to simulation on connection failure
   - server/services/equipment/simulator.service.js — realistic scale simulation with noise (±0.002kg gaussian), settling behavior (exponential with overshoot), stability detection (2s stable = confirmed), 100ms update rate
   - server/services/equipment/opcua.connector.js — OPC UA client using node-opcua, subscribe to scale nodes (GrossWeight, NetWeight, TareWeight, Stable, Status), call Tare method
   - server/services/equipment/mqtt.connector.js — MQTT client, subscribe to topic prefix, parse values, publish tare command
   - server/services/equipment/sparkplug.connector.js — Sparkplug B client for UNS, handle DDATA/DBIRTH/DDEATH messages, send DCMD for tare
   - server/services/equipment/weighing.service.js — business logic: tolerance check, 4-eyes verification, save weighing record with raw data audit trail

4. WebSocket server:
   - server/websocket/equipment.ws.js — WS on path /ws/equipment
   - Protocol: subscribe/unsubscribe to equipment IDs, receive live data, send commands (tare, addWeight for simulation, reset)
   - Attach to existing HTTP server in server/index.js

5. REST routes server/routes/equipment.routes.js (admin for config, auth for usage):
   - CRUD for equipment configs
   - POST /:id/connect, /disconnect, /test
   - GET /:id/status
   - GET /types (available equipment types with defaults)

6. REST routes server/routes/weighing.routes.js (auth required):
   - POST /api/weighing (save weighing record)
   - GET /api/weighing (list with filters)
   - PUT /api/weighing/:id/verify (4-eyes confirmation)
   - GET /api/weighing/:id/audit (raw readings)

7. Seed data: create default equipment config for W-GR-04 (simulation mode, Mettler Toledo ICS689, 50kg capacity, 0.001kg resolution)

8. Wire up in server/index.js: REST routes + WebSocket server

Test: Start server → WS connect to /ws/equipment → subscribe W-GR-04 → receive simulated scale data at 10Hz → send tare command → send addWeight → values settle → confirm weighing → record saved in DB
```

### Equipment Frontend

```
Read .cursorrules and EQUIPMENT-SPEC.md frontend section. Build the scale widget and equipment admin.

1. client/src/composables/useEquipment.js:
   - WebSocket connection to /ws/equipment
   - subscribe(equipmentId) → reactive ref with live values
   - sendCommand(equipmentId, command, params)
   - Auto-reconnect on disconnect

2. client/src/components/equipment/ScaleWidget.vue — THE CORE COMPONENT:
   - Props: equipmentId, targetWeight, tolerancePercent, materialInfo, requiresTare, fourEyes, readOnly
   - Connects via useEquipment composable
   - LCD-style display (dark background, green monospace text): Brutto | Netto | Tara
   - Stability indicator: "STABIL" (green) / "INSTABIL" (yellow, blinking)
   - Connection badge: which protocol is active (Simulation/OPC UA/MQTT/UNS)
   - Buttons: Tara, Material zugeben (simulation only), Gewicht uebernehmen
   - Tolerance bar: visual min-target-max indicator
   - After confirmation: result card with deviation, assessment, signature fields, timestamp
   - Emits @weighing-confirmed with all data for the parent to save

3. Supporting components:
   - ScaleDisplay.vue (LCD display, reusable)
   - ToleranceBar.vue (min/target/max visualization)
   - StabilityIndicator.vue (stable/unstable badge)
   - WeighingResult.vue (result card with signatures)
   - EquipmentConnectionBadge.vue (protocol indicator)

4. Integration into PISheetPreview.vue:
   - When a step has a param with type "scale": render ScaleWidget instead of a text input
   - In print mode: render as table with empty fields for handwriting
   - On @weighing-confirmed: save via POST /api/weighing, update the step param value

5. Admin: client/src/views/EquipmentView.vue — /admin/equipment:
   - Add route and sidebar navigation
   - Stats cards: total, online, offline, simulation counts
   - Equipment table with status badges and connection type
   - Add/Edit modal: base fields + connection type radio buttons + type-specific config forms
   - "Verbindung testen" button with 3s test + result display
   - Live test panel: expandable per equipment showing mini scale display with real-time data

Test: Open a PI Sheet with Einwaage step → ScaleWidget renders → shows live simulated data → Tara → Add material → weight settles → confirm → result saved → print view shows filled values
```
