# PI Sheet Generator

LLM-powered Process Instruction (PI) Sheet generator for pharmaceutical manufacturing — SAP Joule-style chat, GMP workflow, equipment/scales Q&A, and admin tooling.

| Document | Purpose |
|----------|---------|
| **[DOCUMENTATION.md](./DOCUMENTATION.md)** | **Full guide** (DE): setup, chat, „Neues Gespräch“, architecture, env vars |
| [DEV.md](./DEV.md) | Developer handbook: ports, Docker vs local, troubleshooting |
| [MVP4-SPEC.md](./MVP4-SPEC.md) | GMP lifecycle (draft → review → approved → archived) |

**MVP 4** adds GMP lifecycle and QA workflow. If the DB predates MVP4: `node server/scripts/apply-lifecycle-migration.js`.

### Chat highlights

- **Quick prompts** on the start screen (PI Sheet + equipment questions)
- **„Neues Gespräch“** in the shell bar — clears the session and restores the start screen (with confirmation if messages exist)
- **„Verlauf“** — opens saved PI sheets (not per-message chat threads)

After UI changes in Docker: `docker compose --profile full up -d --build client`, then hard refresh (`Ctrl+F5`).

## Port scheme (host, all ≥ 7000)

| Port | Service |
|------|---------|
| **7000** | API (Express) |
| **7001** | SAP MCP Server |
| **7002** | Vite dev UI |
| **7003** | PostgreSQL (Docker) |
| **7004** | Production UI (nginx, Docker `--profile full`) |

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL + pgvector)

## Quick start (Docker — full stack)

```bash
cp .env.docker.example .env
# Edit .env — set ANTHROPIC_API_KEY at minimum

docker compose --profile full up -d
```

| Service | URL |
|---------|-----|
| **App (UI)** | http://localhost:7004 |
| **API** | http://localhost:7000/api |
| **SAP MCP** | http://localhost:7001/health |
| **PostgreSQL** | `localhost:7003` |

DB + SAP MCP only (local Node dev):

```bash
docker compose up -d
```

```bash
npm run docker:logs
npm run docker:down
npm run docker:seed
```

---

## Quick start (local Node dev)

```bash
cp .env.example .env

docker compose up -d
```

> After changing the DB host port to **7003**, recreate the DB container once if you used **5434** before:
> `docker compose down` then `docker compose up -d` (existing volume keeps data; only the host port mapping changes).

```bash
# Optional SAP MCP (separate repo) — must listen on 7001
cd ../sap-mcp-server
# set PORT=7001 in .env, then:
npm start

cd ../pi-sheet-generator
npm install
npm install --prefix server
npm install --prefix client
npm run db:migrate --prefix server
npm run db:seed
npm run dev
```

| Service | URL |
|---------|-----|
| **UI** | http://localhost:7002 |
| **API** | http://localhost:7000/api |

**Credentials**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@pisheet.local` | `admin123` |
| Operator | `operator@pisheet.local` | `operator123` |

Optional: `npm run db:embed` when embedding API keys are set.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express API and Vite frontend |
| `npm run db:migrate` | Run Sequelize migrations |
| `npm run db:seed` | Seed XSteps, users, default prompt |
| `npm run docker:up` | Docker full stack (`--profile full`) |
