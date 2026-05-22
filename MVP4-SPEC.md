# MVP 4 — PI-Sheet Lifecycle & GMP-Freigabe

## Ziel

KI-generierte PI Sheets durchlaufen einen **GxP-Workflow** vor dem Einsatz in der Produktion:

`draft` → `in_review` → `approved` → `archived`

## Rollen

| Rolle | Rechte |
|-------|--------|
| **Operator** | Eigene Entwürfe einreichen; freigegebene/archivierte Sheets lesen |
| **Admin (QA)** | Prüfen, freigeben, ablehnen, archivieren; alle Sheets sehen |

## API

Basis: `/api/templates`

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/` | Liste (Operator: eigene + freigegebene) |
| GET | `/:id` | Detail mit Lifecycle-Zugriff |
| GET | `/:id/pdf` | PDF mit Status/Freigabe-Kopf |
| POST | `/:id/submit` | Entwurf → In Prüfung |
| POST | `/:id/reject` | In Prüfung → Entwurf (Kommentar Pflicht, Admin) |
| POST | `/:id/approve` | In Prüfung → Freigegeben (Admin) |
| POST | `/:id/archive` | Freigegeben → Archiviert (Admin) |

Audit: `pi_sheet_submit`, `pi_sheet_approve`, `pi_sheet_reject`, `pi_sheet_archive` in `audit_logs`.

## Datenbank

Migration `20250522000012-pi-sheet-lifecycle.js`:

- `batch_number`, `order_number`
- `submitted_at`, `submitted_by`
- `approved_at`, `approved_by`
- `review_comment`

## UI

- **Chat-Vorschau:** Workflow-Leiste (Einreichen / Freigeben / Ablehnen)
- **Admin → PI Sheets (Freigabe):** Warteschlange, Filter `in_review`
- **Admin → Audit-Log:** paginierte Einträge

## Testplan

1. Als Operator PI Sheet im Chat erzeugen → **Zur Prüfung einreichen**
2. Als Admin `/admin/pi-sheets?status=in_review` → **Freigeben**
3. Vorschau read-only, PDF mit „Freigegeben“-Zeile
4. Optional: **Ablehnen** mit Kommentar → Operator sieht Hinweis im Entwurf

## Migration

```bash
npm run db:migrate --prefix server
```
