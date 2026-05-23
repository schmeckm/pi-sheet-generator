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

`AUTO_SEED` nach erstem erfolgreichen Start auf `false` setzen und Stack **Update** ausführen (verhindert erneutes Überschreiben der Demo-XSteps).

Bei **jedem** API-Start läuft nach den Migrationen **`seed-deploy.js`** (idempotent):

| Immer | Nur bei `AUTO_SEED=true` (oder leerer DB ohne User) |
|-------|------------------------------------------------------|
| System-Settings, Prozessgraph, Demo-Equipment (6 Geräte) | Demo-User, Prompt-Configs, 24 XSteps |

Manuell im API-Container:

```bash
docker exec -it <api-container-name> node seeders/seed-deploy.js
```

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

### Waagen-Widget: „Command timeout“

Live-Waagen nutzen **WebSocket** `wss://<domain>/ws/equipment` (über nginx im Client-Container → API).

In **Nginx Proxy Manager** für `pisheet.iotshowroom.de`:

- **Websockets Support: ON**
- Forward zu `pi-sheet-generator-client-1:80` (nicht direkt API)
- **Advanced** (Custom Nginx Configuration) für Chat-SSE — verhindert `ERR_HTTP2_PROTOCOL_ERROR` beim PI-Sheet-Stream:

```nginx
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_read_timeout 600s;
```

Falls der Chat-Stream weiter abbricht: in NPM testweise **HTTP/2 am Host deaktivieren** (manche Versionen brechen lange SSE über HTTP/2 ab). Die App fällt danach automatisch auf `POST /api/chat/generate` ohne Live-Streaming zurück.

Demo-Geräte: einmal `node seeders/seed-equipment.js` im API-Container, falls die Equipment-Liste leer ist.

---

## 6. Fehlerbehebung

### `getaddrinfo ENOTFOUND db` (API-Logs)

Der Hostname **`db`** existiert nur **innerhalb des Stacks** (Service-Name der PostgreSQL-Container).

**Ursachen:**

- Nur der **API-Container** wurde neu gestartet / aus einem Image erstellt, **ohne** den Stack (`db` fehlt im Netzwerk).
- Stack unvollständig (nur `api` + `client`, **ohne** Service `db`).
- `DATABASE_URL` zeigt auf `@db:5432`, aber der Postgres-Service heißt anders.

**Lösung:**

1. **Stacks → pi-sheet-generator** — nicht einzeln unter **Containers** nur `api` starten.
2. Stack **Update** oder **Pull and redeploy** (alle Services: `db`, `api`, `client`).
3. In den API-Logs sollte zuerst stehen: `[wait-for-db] Database is reachable.` — sonst bleibt der Container in einer Restart-Schleife (korrekt).
4. `DATABASE_URL` in Portainer-Env: `postgres://pisheet:${POSTGRES_PASSWORD}@db:5432/pisheet` (Host **`db`**, nicht `localhost`).

### `db` is unhealthy

Der Stack wartet mit **DB-Healthcheck**, bis Postgres `pg_isready` meldet, dann startet die API.

Wenn `db` **unhealthy** bleibt:

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
   - **`No space left on device`** / `could not create directory .../pg_wal` → **Festplatte auf dem Docker-Host voll** — siehe Abschnitt unten  
   - `exec format error` → falscher CPU-Typ (ARM vs. amd64) — Host-Architektur prüfen  
5. Nach Deploy **2–3 Minuten warten** — API kann erst nach DB-Init healthy werden.

### `No space left on device` (PostgreSQL / db)

Die Datenbank braucht beim ersten Start freien Speicher (typisch **≥ 2–5 GB** auf dem Docker-Volume-Pfad).

**Auf dem Host (SSH oder Terminal am NAS/Server):**

```bash
df -h
docker system df
```

**Speicher freigeben:**

```bash
# Ungenutzte Images, gestoppte Container, Build-Cache (Vorsicht: entfernt unbenutztes)
docker system prune -a

# Nur wenn pi-sheet-Stack schon entfernt wurde — sonst DB-Daten weg:
docker volume prune
```

In **Portainer:** **Images** → unbenutzte Images löschen · **Volumes** → alte Test-Volumes löschen.

Danach:

1. Stack `pi-sheet-generator` entfernen (**mit** Volume `pgdata`, falls kaputt/leer)
2. Prüfen: `df -h` zeigt wieder freien Platz auf der Partition, wo Docker Daten speichert
3. Stack neu deployen

**Synology/QNAP:** Speicherplatz in der Verwaltung prüfen; Docker-Volume oft auf Volume mit wenig Rest — Docker nach größerem Volume verschieben oder Dateien löschen.

### Weitere Probleme

| Problem | Lösung |
|---------|--------|
| Actions schlägt fehl | Secrets `DOCKERHUB_*` prüfen |
| Portainer `pull access denied` | Image public oder Registry in Portainer anlegen |
| UI lädt, API 502 | API-Container-Logs; ENOTFOUND `db` → vollen Stack redeployen; sonst ~2 Min. warten |
| `ENOTFOUND db` | Vollen Stack deployen; nicht nur API-Container isoliert starten |
| CORS-Fehler | `CORS_ORIGINS` um Ihre URL ergänzen (z. B. `http://192.168.1.5:7004`) |
| Keine KI-Antwort | `ANTHROPIC_API_KEY` in Stack-Env |
| Prozessgraph / XSteps leer | API-Logs: `=== Deploy seed` / Fehlerzeilen; `docker exec … node seeders/seed-deploy.js`; Image `latest` pullen |

---

## Lokaler Vergleich

| Modus | Compose-Datei |
|-------|----------------|
| Entwicklung + Build lokal | `docker-compose.yml` (`--profile full`) |
| Produktion Portainer | `deploy/portainer-stack.yml` (nur Hub-Images) |
