# Deployment: GitHub → Docker Hub → Portainer

Automated Docker images are built on every push to `main` and published to Docker Hub. Portainer pulls those images via a stack file — no local build on the server.

---

## 1. GitHub Secrets (einmalig)

Repository: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `DOCKERHUB_USERNAME` | Docker Hub Benutzername (z. B. `schmeckm`) |
| `DOCKERHUB_TOKEN` | [Access Token](https://hub.docker.com/settings/security) (Berechtigung: Read & Write) |

Workflow: [.github/workflows/docker-publish.yml](../.github/workflows/docker-publish.yml)

Nach Push auf `main` erscheinen die Images:

- `DOCKERHUB_USERNAME/pi-sheet-generator-api:latest`
- `DOCKERHUB_USERNAME/pi-sheet-generator-client:latest`

Status: **Actions**-Tab auf GitHub.

---

## 2. Docker Hub (optional prüfen)

https://hub.docker.com/r/schmeckm/pi-sheet-generator-api  
https://hub.docker.com/r/schmeckm/pi-sheet-generator-client  

Repository auf **Public** stellen, damit Portainer ohne Login pullen kann — oder in Portainer Registry-Credentials hinterlegen.

---

## 3. Portainer Stack

### Variante A — Web editor (empfohlen)

1. **Portainer → Stacks → Add stack**
2. Name: `pi-sheet-generator`
3. **Web editor:** Inhalt von [deploy/portainer-stack.yml](../deploy/portainer-stack.yml) einfügen
4. **Environment variables:** Werte aus [deploy/.env.portainer.example](../deploy/.env.portainer.example) eintragen (mindestens `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANTHROPIC_API_KEY`)
5. **Deploy the stack**

### Variante B — Git repository

1. **Add stack → Repository**
2. URL: `https://github.com/schmeckm/pi-sheet-generator`
3. **Compose path:** `deploy/portainer-stack.yml`
4. Env-Datei oder Variablen wie oben

### Nach dem Start

| URL | Dienst |
|-----|--------|
| `http://<SERVER>:7004` | Web-UI (Standard-Port `CLIENT_PORT`) |
| Intern | API nur über nginx (`/api` vom Client-Container) |

**Demo-Login** (wenn `AUTO_SEED=true`):  
`admin@pisheet.local` / `admin123`

`AUTO_SEED` nach erstem erfolgreichen Start auf `false` setzen und Stack **Update** ausführen.

---

## 4. Updates

1. Code nach `main` pushen → GitHub Actions baut neue Images (`:latest` + Commit-SHA-Tag)
2. Portainer → Stack → **Pull and redeploy** (oder **Update the stack** mit `IMAGE_TAG=latest`)

Für feste Version: `IMAGE_TAG=<git-sha>` aus dem Actions-Log setzen.

---

## 5. Architektur (Portainer)

```
Internet/LAN → :7004 → client (nginx)
                          ├─ /     → Vue static
                          ├─ /api/ → api:7000
                          └─ /ws/  → api WebSocket
                    api → db (PostgreSQL + pgvector)
```

**SAP MCP** ist in diesem Stack **nicht** enthalten (`SAP_MCP_ENABLED=false`). Equipment-Live-Daten erfordern einen erreichbaren MCP-Endpunkt (HTTPS) — siehe [DEV.md](./DEV.md).

---

## 6. Fehlerbehebung

### `db` is unhealthy

Der aktuelle Stack hat **keinen DB-Healthcheck** mehr (API startet nach `db`, mit `restart: unless-stopped`).

Wenn die Meldung **trotzdem** erscheint, läuft noch eine **alte Compose-Version** in Portainer:

1. Stack **komplett entfernen** → **„Remove volumes“** aktivieren.
2. Compose neu einfügen von:  
   https://raw.githubusercontent.com/schmeckm/pi-sheet-generator/main/deploy/portainer-stack.yml
3. Env-Variablen prüfen — **diese drei müssen gesetzt sein:**

| Variable | Beispiel |
|----------|----------|
| `POSTGRES_PASSWORD` | `PiSheetDb2026Secure` (nur Buchstaben/Zahlen) |
| `JWT_SECRET` | mind. 32 Zeichen |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

4. **Containers → db → Logs:**  
   - `Permission denied` → Volume/Rechte auf NAS  
   - `No space left` → Speicher freigeben  
   - `exec format error` → falscher CPU-Typ (ARM vs. amd64) — Host-Architektur prüfen  
5. Nach Deploy **2–3 Minuten warten** — API kann erst nach DB-Init healthy werden.

### Weitere Probleme

| Problem | Lösung |
|---------|--------|
| Actions schlägt fehl | Secrets `DOCKERHUB_*` prüfen |
| Portainer `pull access denied` | Image public oder Registry in Portainer anlegen |
| UI lädt, API 502 | API-Container-Logs; `depends_on` abwarten (~60 s) |
| CORS-Fehler | `CORS_ORIGINS` um Ihre URL ergänzen (z. B. `http://192.168.1.5:7004`) |
| Keine KI-Antwort | `ANTHROPIC_API_KEY` in Stack-Env |

---

## Lokaler Vergleich

| Modus | Compose-Datei |
|-------|----------------|
| Entwicklung + Build lokal | `docker-compose.yml` (`--profile full`) |
| Produktion Portainer | `deploy/portainer-stack.yml` (nur Hub-Images) |
