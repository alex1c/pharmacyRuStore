# Project status

## Current phase

**Phase 1 — Аптечки / лекарства / партии** (complete)

## Completed

### Phase 0
- Expo SDK 57 foundation, tabs, design system, SQLite migrations, seed, abstractions

### Phase 1
- Schema v2: `storage_locations`, `medicines`, `medicine_batches`
- Cabinet / location CRUD with safe archive
- Medicine + pack (batch) CRUD; `medicine ≠ batch`
- Inventory list: search, cabinet filter, sort, summaries
- Quantity aggregation + nearest expiry
- Gallery photo copy into app storage
- Russian decimal input / quantity formatting
- Expiry as `YYYY-MM` or `YYYY-MM-DD` (no timezone shift)

## Known issues

- Archived medicine photos are not deleted from disk yet (deferred cleanup)
- Expiry / stock warnings dashboard not implemented (Phase 2)

## Deferred

- Expiry & stock warnings (Phase 2)
- Courses / intake confirmation (Phase 3)
- Native reminders (Phase 4)
- Shopping list & family management (Phase 5)
- Package scanning (Phase 6)
- Backup / restore (Phase 7)
- AppMetrica + РСЯ production SDKs (Phase 8)
- Final icon, RuStore screenshots, release keystore (Phase 9)

## Next checkpoint

Phase 2 — expiry, stock warnings and attention dashboard

## Last verified commit SHA

_Pending — filled after Phase 1 commit._
