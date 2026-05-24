# Dokumentation — X-Steps AI Composer

| Dokument | Inhalt |
|----------|--------|
| **[DOCUMENTATION.md](./DOCUMENTATION.md)** | Vollständiges Handbuch (DE) |
| **[DOCUMENTATION.en.md](./DOCUMENTATION.en.md)** | Full guide (EN) |
| **[DEV.md](./DEV.md)** | Entwickler-Referenz (Ports, Docker, Fehlerbehebung) |
| **[../client/src/content/architectureHelp.js](../client/src/content/architectureHelp.js)** | In-App Hilfe & Architektur (DE/EN, UI-Sprache) |
| **[../.github/REPOSITORY_SETTINGS.md](../.github/REPOSITORY_SETTINGS.md)** | GitHub-Beschreibung, Topics, Labels (Checkliste) |
| **[DEPLOY-PORTAINER.md](./DEPLOY-PORTAINER.md)** | GitHub Actions → Docker Hub → Portainer Stack |

## Spezifikationen (`specs/`)

| Datei | Thema |
|-------|--------|
| [MVP4-SPEC.md](./specs/MVP4-SPEC.md) | GMP-Lifecycle, Freigabe-Workflow |
| [MVP5-SPEC.md](./specs/MVP5-SPEC.md) | Prozess-Wissensgraph (5.1) |
| [EQUIPMENT-SPEC.md](./specs/EQUIPMENT-SPEC.md) | Waagen, OPC-UA/UNS, MCP, LLM-Tools |
| [IMPORT-SPEC.md](./specs/IMPORT-SPEC.md) | Multi-Format-Import (CSV, Excel, JSON, …) |
| [MVP2-SPEC.md](./specs/MVP2-SPEC.md) | Vision, Knowledge Base, SAP MCP (Roadmap) |

## Cursor-Playbooks (`playbooks/`)

Implementierungs-Prompts für Cursor Agent (historisch nach MVP-Versionen):

| Datei | MVP |
|-------|-----|
| [mvp1-playbook.md](./playbooks/mvp1-playbook.md) | Basis: DB, Auth, Chat, Repository |
| [mvp2-playbook.md](./playbooks/mvp2-playbook.md) | Vision, Knowledge, SAP |
| [mvp3-playbook.md](./playbooks/mvp3-playbook.md) | Equipment, Waagen, Q&A-Chat |
| [cursor-prompt.md](./playbooks/cursor-prompt.md) | Kurz-Prompt-Vorlage |

## Projektstruktur

```
pi-sheet-generator/
├── README.md                 # Einstieg & Quick Start
├── docker-compose.yml
├── package.json
├── .env.example
├── .env.docker.example
├── client/                   # Vue 3 SPA (Vite)
├── server/                   # Express API, Sequelize, Services
├── docker/                   # Dockerfiles (api, client)
├── docs/                     # ← Sie sind hier
│   ├── DOCUMENTATION.md
│   ├── DEV.md
│   ├── specs/
│   └── playbooks/
└── fixtures/                 # Test-CSV, Bilder für Scripts
    ├── test-xsteps.csv
    └── images/
```
