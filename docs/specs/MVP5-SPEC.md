# MVP 5 — Prozess-Wissensgraph

## 5.1 (implementiert)

Struktur-Graph in PostgreSQL (`process_graph_edges`):

| Kantentyp | Bedeutung |
|-----------|-----------|
| `FOLLOWS` | XStep A → XStep B (Prozessreihenfolge) |
| `USES_EQUIPMENT` | XStep → Equipment-ID |
| `REQUIRES` | Abhängigkeit (erweiterbar) |
| `APPLIES_TO` | Regel → Prozesstyp |
| `MAPS_TO_SAP` | XStep → SAP-Objekt (erweiterbar) |

### API

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/graph/context?process_type=` | Kette + Anforderungen |
| GET | `/api/graph/edges` | Kanten (Filter) |
| POST | `/api/graph/edges` | Kante anlegen (Admin) |
| DELETE | `/api/graph/edges/:id` | Kante löschen (Admin) |

### LLM

`llm.service` liefert Graph-Kontext vor XSteps; `recommended_step_order` steuert Reihenfolge.

### Seed

```bash
node server/seeders/seed-graph.js
```

Verpackung: XS-VP-001 … XS-VP-009; Granulation: XS-GR-001 → W-GR-04.

### UI

Admin → **Prozessgraph** (`/admin/process-graph`).

## 5.3 (implementiert)

LLM-Tools im Q&A-Modus:

- `get_process_chain(process_type)`
- `get_step_requirements(process_type, xstep_id)`

PI-Sheet-Speicherung: automatische **Graph-Warnungen** bei abweichender Schrittfolge.

## 5.2+ (Roadmap)

GraphRAG aus Wissensbasis, SAP-Sync, Graph-Explorer mit Lineage.
