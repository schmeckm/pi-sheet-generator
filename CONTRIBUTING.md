# Contributing

Thank you for your interest in the PI Sheet Generator project.

## Before you start

1. Read [docs/DEV.md](./docs/DEV.md) for local setup.
2. Do **not** commit `.env`, API keys, or `login.json`.
3. AI-generated PI sheets are GxP drafts — keep regulatory wording accurate in docs and UI.

## Pull requests

1. Fork the repository and create a feature branch from `main`.
2. Keep changes focused; match existing code style (Vue Composition API, Express services).
3. Run `npm test` in `server/` when touching backend logic.
4. Update [docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md) or README if behavior or setup changes.
5. Open a PR with a clear description and test steps.

## Issues

Use the GitHub issue templates (bug / feature / documentation). Include:

- Environment (Docker vs local, OS, Node version)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (API container or `npm run dev` terminal)

## Code of conduct

Be respectful and professional. This project targets regulated manufacturing contexts.
