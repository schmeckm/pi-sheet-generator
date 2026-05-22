# GitHub repository settings (manual checklist)

Apply these in **GitHub → schmeckm/pi-sheet-generator → Settings** so the repository looks complete.

## About (right sidebar on repo home)

| Field | Suggested value |
|-------|-----------------|
| **Description** | LLM PI Sheet generator for pharma manufacturing — SAP Joule-style chat, GMP workflow, XStep RAG, equipment Q&A |
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

## Security

- [ ] **Private vulnerability reporting** enabled (see [SECURITY.md](../SECURITY.md))
- [ ] **Dependabot alerts** enabled (Settings → Code security)

## Social preview

Settings → General → **Social preview** — upload a screenshot of the PI Assistant chat (1280×640 recommended).

## One-line CLI (after `gh auth login`)

```powershell
gh repo edit schmeckm/pi-sheet-generator `
  --description "LLM PI Sheet generator for pharma manufacturing — SAP Joule-style chat, GMP workflow, XStep RAG, equipment Q&A" `
  --add-topic pharmaceutical --add-topic manufacturing --add-topic gmp --add-topic vue3 --add-topic nodejs --add-topic llm --add-topic docker
```
