# GitHub repository settings (manual checklist)

Apply these in **GitHub → schmeckm/pi-sheet-generator → Settings** so the repository looks complete.

## About (right sidebar on repo home)

| Field | Suggested value |
|-------|-----------------|
| **Description** | X-Steps AI Composer — LLM PI Sheet composer for pharma manufacturing — SAP Joule-style chat, GMP workflow, XStep RAG, equipment Q&A |
| **Website** | *(optional)* link to internal demo |
| **Topics** | `pharmaceutical` `manufacturing` `gmp` `process-instruction` `vue3` `nodejs` `express` `postgresql` `pgvector` `anthropic` `claude` `llm` `rag` `docker` `sap` `equipment` `opc-ua` |

## General

- [ ] Default branch: `main`
- [ ] **License:** MIT (detected from `LICENSE` after push)
- [ ] **Releases:** optional tags `v0.1.0` for pilot milestone

## Features (Settings → General)

- [ ] **Issues** enabled
- [ ] **Discussions** optional
- [ ] **Wiki** off (docs live in `/docs`)
- [ ] **Projects** optional

## Labels

After push, sync labels (requires `gh auth login`):

```powershell
.\scripts\sync-github-labels.ps1
```

Or create labels manually from [.github/labels.yml](./labels.yml).

## GitHub Actions (Docker Hub)

Repository → **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub user (e.g. `schmeckm`) |
| `DOCKERHUB_TOKEN` | Hub access token (read/write) |

Workflow [.github/workflows/docker-publish.yml](./workflows/docker-publish.yml) runs on push to `main`.

## Security

- [ ] **Private vulnerability reporting** enabled (see [SECURITY.md](../SECURITY.md))
- [ ] **Dependabot alerts** enabled (Settings → Code security)

## Social preview

Settings → General → **Social preview** — upload a screenshot of the X-Steps AI Composer chat (1280×640 recommended).

## One-line CLI (after `gh auth login`)

```powershell
gh repo edit schmeckm/pi-sheet-generator `
  --description "X-Steps AI Composer — LLM PI Sheet composer for pharma manufacturing — SAP Joule-style chat, GMP workflow, XStep RAG, equipment Q&A" `
  --add-topic pharmaceutical --add-topic manufacturing --add-topic gmp --add-topic vue3 --add-topic nodejs --add-topic llm --add-topic docker
```
