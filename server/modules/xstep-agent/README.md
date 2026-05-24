# XStep Agent MVP

Isolated module for AI-assisted **PI Sheet / XStep Template Composer** (no SAP write-back).

## Location

Backend path: `server/modules/xstep-agent/` (equivalent to plan `src/modules/xstep-agent`).

## Enable

```env
XSTEP_AGENT_ENABLED=true
XSTEP_AGENT_LLM_PROVIDER=mock   # mock | ollama | openai
```

Restart API after changing env.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/xstep-agent/health` | Module health |
| POST | `/api/v1/xstep-agent/retrieve` | Mock retrieval (keyword + metadata) |
| POST | `/api/v1/xstep-agent/compose-template` | Generate template JSON |
| POST | `/api/v1/xstep-agent/validate-template` | Rule validation |

## Example

```bash
curl -X POST http://localhost:7000/api/v1/xstep-agent/compose-template \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"Create a pharmaceutical packaging PI Sheet template for blister packaging including material identification, line clearance, goods movement, IPC checks and electronic signature.\"}"
```

## Tests

```bash
npm run test --prefix server
```

## Golden rules

- Feature-flagged (`XSTEP_AGENT_ENABLED`)
- Mock data first
- Structured JSON output only
- No SAP write-back
- No autonomous GMP approval
- Human review required (`DRAFT_REQUIRES_REVIEW`)
