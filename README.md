# PI Sheet Generator

LLM-powered Process Instruction (PI) Sheet generator for pharmaceutical manufacturing — SAP Joule-style chat, GMP workflow, equipment/scales Q&A, and admin tooling.

## Documentation

| Document | Purpose |
|----------|---------|
| **[docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md)** | Full guide (DE): setup, chat, architecture, env vars |
| **[docs/DEV.md](./docs/DEV.md)** | Developer handbook: ports, Docker, troubleshooting |
| **[docs/README.md](./docs/README.md)** | Specs, playbooks, project layout |

## Quick start (Docker)

```bash
cp .env.docker.example .env
# Set ANTHROPIC_API_KEY at minimum

docker compose --profile full up -d --build
```

| Service | URL |
|---------|-----|
| **UI** | http://localhost:7004 |
| **API** | http://localhost:7000/api |

**Login:** `admin@pisheet.local` / `admin123` · `operator@pisheet.local` / `operator123`

After UI code changes: `docker compose --profile full up -d --build client` and hard refresh (`Ctrl+F5`).

## Quick start (local dev)

```bash
cp .env.example .env
docker compose up -d
npm install && npm install --prefix server && npm install --prefix client
npm run db:migrate --prefix server && npm run db:seed
npm run dev
```

| Service | URL |
|---------|-----|
| **UI** | http://localhost:7002 |
| **API** | http://localhost:7000/api |

## Ports

| Port | Service |
|------|---------|
| 7000 | API |
| 7001 | SAP MCP |
| 7002 | Vite dev UI |
| 7003 | PostgreSQL |
| 7004 | Docker UI (nginx) |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + Vite |
| `npm run docker:up` | Full Docker stack |
| `npm run db:seed` | Demo users, XSteps, prompt |

## Project layout

```
client/     Vue 3 frontend
server/     Express API
docker/     Container images
docs/       Documentation & specs
fixtures/   Sample CSV/images for tests
```
