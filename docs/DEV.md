# Entwickler-Handbuch — PI Sheet Generator

Kurzreferenz für lokale Entwicklung, Docker und typische Stolpersteine.

## Port-Matrix (Host)

| Port | Dienst | Wann |
|------|--------|------|
| **7000** | API (Express) | `npm run dev` **oder** Docker `api` — **nicht beides gleichzeitig** |
| **7001** | SAP MCP Server | Docker `sap-mcp` oder separates Repo |
| **7002** | Vite Dev UI | Nur `npm run dev` (Client) |
| **7003** | PostgreSQL + pgvector | Docker `db` |
| **7004** | Produktions-UI (nginx) | Docker `client` (`--profile full`) |

## Zwei Betriebsarten

### A) Lokal entwickeln (empfohlen für Code-Änderungen)

```bash
docker compose up -d          # nur DB (+ optional sap-mcp)
npm run dev                   # API :7000 + UI :7002
```

- UI: http://localhost:7002  
- API: http://localhost:7000/api  
- Hot-Reload für Client und Server (nodemon)

### B) Vollständig in Docker

```bash
# Zuerst lokalen Dev-Server stoppen (sonst Port 7000 belegt)
npm run docker:up             # = compose --profile full up -d --build
```

- UI: http://localhost:7004  
- API: http://localhost:7000/api  
- Nach Code-Änderungen: `docker compose --profile full up -d --build api client`

## Häufige Fehler

### `bind: Only one usage of each socket address` (Port 7000)

Ein **Node-Prozess** läuft noch (meist `npm run dev`):

```powershell
netstat -ano | findstr ":7000"
taskkill /PID <PID> /F
```

Dann erneut `npm run docker:up`.

### API-Container: `exec /docker-entrypoint.sh: no such file or directory`

Windows-Zeilenenden (CRLF) im Entrypoint — im Dockerfile wird `sed` angewendet. Image neu bauen:

```bash
docker compose --profile full build api
```

### KI antwortet nicht / 503

- `ANTHROPIC_API_KEY` in `.env` setzen  
- API-Logs: `docker compose logs -f api` oder Terminal von `npm run dev`

## Datenbank

```bash
npm run db:migrate --prefix server   # Migrationen
npm run db:seed                      # XSteps, Users, Prompt „default“
npm run db:seed-equipment            # Waagen-Demo
```

Prompt-Standardtext wird bei Seed in **„default“** geschrieben (`server/seeders/default-system-prompt.js`).

## Prompt Config (Admin)

| Tab | Funktion |
|-----|----------|
| **System-Prompt** | Editor: **Bearbeiten / Vorschau / Diff**, Vollbild, Bausteine, Standard laden |
| **Verlauf** | Ältere Version vor jedem Speichern → **Diese Version laden** |
| **Test** | Modus **Automatisch / PI Sheet / Equipment Q&A** |

Test kostet echte Claude-API-Calls.

## Chat

- API liefert `requestMode`: `pi_sheet` | `qa`
- **Equipment-Fragen** nutzen SSE (`POST /api/chat/qa-stream`) mit Live-Text und Tool-Hinweisen
- Quick-Prompts: PI Sheet + Equipment/Waagen
- **Neues Gespräch** (Shell-Leiste oder Verlauf-Sidebar): leert die Session, zeigt wieder Welcome + Quick-Prompts; bei laufender Generierung Bestätigungsdialog (`client/src/composables/useNewChat.js`)

## Equipment (Admin)

- **Waagen-Übersicht** mit Online-Status
- **Namespace-Suche** (OPC UA / UNS / MQTT) unter Equipment

## PI Sheet Vorschau

- **GMP-Stepper** (Entwurf → Prüfung → Freigegeben → Archiv) + Workflow-Aktionen
- **Druck** (Browser) und **PDF**-Download

## Chat — zwei Modi

| Anfrage | Backend | UI-Fortschritt |
|---------|---------|----------------|
| „Erstelle PI Sheet …“ | `generatePISheet` → JSON | XSteps / GMP |
| „Welche Waagen …“ | `answerChat` + Equipment-Tools | Equipment / Namespace |

PI-Sheet-Generierung erhält zusätzlich **konfigurierte Geräte** als JSON im User-Kontext (keine erfundenen `equipment_id`).

## Umgebungsvariablen

Kopieren: `.env.example` → `.env` (lokal) bzw. `.env.docker.example` → `.env` (Docker).

Wichtig: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, optional `SAP_MCP_URL` / `SAP_MCP_ENABLED`.

## Nützliche Befehle

```bash
npm run dev
npm run test
npm run docker:logs
npm run docker:seed
```

Weitere Spezifikation: [README.md](../README.md), [DOCUMENTATION.md](./DOCUMENTATION.md), [docs/README.md](./README.md), [mvp3-playbook.md](./playbooks/mvp3-playbook.md).
