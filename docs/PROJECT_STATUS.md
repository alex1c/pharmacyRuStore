# Project status

## Current phase

**Phase 2 — Сроки / остатки / «Требует внимания»** (complete)

## Completed

### Phase 0
- Expo SDK 57 foundation, tabs, design system, SQLite migrations, seed, abstractions

### Phase 1
- Schema v2 inventory: cabinets, locations, medicines, batches
- Medicine ≠ batch; search/filter/CRUD; photos

### Phase 2
- Schema v3: `medicines.low_stock_threshold`, settings in `app_meta`
- Effective expiry (package vs after-opening), YYYY-MM → last day of month
- Stock status: empty / low / in_stock (equal threshold = in_stock)
- Shared inventory summary + attention priority
- Today attention dashboard; inventory status/filter/sort
- Stock control settings; per-medicine low-stock override
- Compatible unit policy for active packs

## Known issues

- Archived medicine photos are not deleted from disk yet
- Full shopping list not implemented (Phase 5)

## Deferred

- Courses / intake confirmation (Phase 3)
- Native reminders (Phase 4)
- Shopping list & family management (Phase 5)
- Package scanning (Phase 6)
- Backup / restore (Phase 7)
- AppMetrica + РСЯ production SDKs (Phase 8)
- Final icon, RuStore screenshots, release keystore (Phase 9)

## Expiry / stock policy (Phase 2)

- Warning window default: 30 days (7/14/30/60/90 presets)
- Low stock default: 5 (override per medicine)
- `quantity < threshold` → low; `quantity == threshold` → in stock
- Attention priority: expired → empty → expiring soon → low stock
- One attention card per medicine

## Next checkpoint

Phase 3 — medication schedules, intake tracking and history

## Last verified commit SHA

d1eff8ab5fb1439b50128c32f921c602e021b2f0
