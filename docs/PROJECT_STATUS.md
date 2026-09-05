# Project status

## Current phase

**Phase 7 — Full backup / restore / export** (complete)

## Completed

### Phase 0–6
Foundation through scanning/fast entry (schema v1–v7).

### Phase 7
- Logical ZIP backup (`manifest.json` + `data.json` + `media/`), formatVersion 1
- Replace-policy restore with validation, operation lock, safety rollback
- Media remapping; `scheduled_notifications` excluded; post-restore shopping + reminder sync
- Inventory CSV export (UTF-8 BOM, `;`)
- UI: Ещё → Резервная копия
- See [`docs/BACKUP_FORMAT.md`](BACKUP_FORMAT.md)

## Phase 4 note

Functional native reminders confirmed in prior checkpoint; extended native matrix deferred to final release QA.

## Known issues

- Archived medicine photos not deleted from disk yet
- Exact alarm special access may be denied on Android 14+ by default
- Physical-device barcode scan QA deferred
- Backup ZIP is not encrypted

## Deferred

- AppMetrica + ads (Phase 8)
- Final icon / screenshots / release signing (Phase 9)
- Extended native notification matrix
- Remote medicine catalogue enrichment
- Optional encrypted backup

## Next checkpoint

Codex Phase 7 round-trip review → then Phase 8 (analytics/ads) when ready

## Last verified commit SHA

`c20da1a57e4953f8c096570bdbe6d56fb0cae789`
