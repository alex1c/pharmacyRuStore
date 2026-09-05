# Project status

## Current phase

**Phase 6 — Сканирование и быстрый ввод** (complete)

## Completed

### Phase 0–4
Foundation, inventory, expiry/stock, courses/intake, native local reminders (schema v1–v5).

### Phase 5
Family CRUD + shopping lifecycle (schema v6).

### Phase 6
- Schema v7: `medicine_codes`; batch `lot_number` / `serial_number` / `scanned_code_raw`
- `expo-camera` scanner (EAN/UPC/Code128/QR/DataMatrix) with torch + manual code entry
- Best-effort GS1 parser; local code matching; no mandatory external API
- Fast entry: recent medicines, duplicate name warning, shopping «Куплено» → scan
- See [`docs/SCANNING_ARCHITECTURE.md`](SCANNING_ARCHITECTURE.md)

## Phase 4 note

Functional native reminders confirmed in prior checkpoint; extended native matrix deferred to final release QA.

## Known issues

- Archived medicine photos not deleted from disk yet
- Exact alarm special access may be denied on Android 14+ by default
- Physical-device barcode scan QA deferred (emulator uses manual code entry)

## Deferred

- Backup / restore (Phase 7)
- AppMetrica + ads (Phase 8)
- Final icon / screenshots / release signing (Phase 9)
- Extended native notification matrix
- Remote medicine catalogue enrichment

## Next checkpoint

Phase 7 — full backup, restore and export

## Last verified commit SHA

(pending Phase 6 commit)
