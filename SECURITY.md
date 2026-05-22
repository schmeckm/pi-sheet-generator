# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main`  | Yes       |

## Reporting a vulnerability

Please **do not** open public issues for security problems.

1. Email or contact the repository owner via GitHub private security advisory:  
   https://github.com/schmeckm/pi-sheet-generator/security/advisories/new
2. Include steps to reproduce, impact, and suggested fix if known.

## Scope notes

- Default demo credentials (`admin@pisheet.local` / `admin123`) are for **local pilot only** — change `JWT_SECRET` and passwords before any exposed deployment.
- Never commit `.env` files or API keys.
- Rate limiting is enabled on login and chat routes; still treat the API as internal/network-restricted in production scenarios.
