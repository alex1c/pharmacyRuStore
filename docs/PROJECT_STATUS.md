# Project status

## Current phase

**Phase 3 — Курсы, расписания, приём и история** (complete)

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

### Phase 3
- Schema v4: `medication_courses`, `medication_schedules`, `intake_records`, `intake_inventory_movements`
- Schedule types: daily, weekdays, every N days, one-time, PRN
- Occurrence identity: `scheduleId + YYYY-MM-DD + HH:mm` (unique active index)
- Today «Приём сегодня» with taken / skip / snooze (+10/+30/+60) / take-all
- Intake tab: active courses + history (filter, pagination)
- FEFO inventory debit with multi-pack split and movement ledger
- Shortfall policy: warn → allow partial consume → `inventoryShortfall`, never negative qty
- Atomic undo restores ledger quantities
- Medicine detail «Приём» section + «Добавить в расписание»
- No native notifications (Phase 4)

## Schedule / intake policy

- Calendar dates: `YYYY-MM-DD`; schedule times: local `HH:mm`; actual events: ISO UTC
- Occurrences generated on demand (not pre-materialized forever)
- Interval schedules count from `course.startDate`
- Weekdays: bitmask Mon=1 … Sun=64 (locale-independent)
- Editing schedule archives old rules and inserts new ones — past intake history is not rewritten
- Finishing a course sets `endDate` + archives; history rows remain (no CASCADE wipe)
- Dose unit must match active inventory unit; no tablet↔ml conversion
- Dose correction that recalculates inventory is deferred; meta edit / undo-delete supported

## Inventory shortfall policy

If available stock &lt; planned dose:

1. Show warning with available vs dose
2. On «Всё равно отметить приём»: create `taken` record, consume available only, set `inventoryShortfall=true`
3. Never write negative `quantity`

## Known issues

- Archived medicine photos are not deleted from disk yet
- Full shopping list not implemented (Phase 5)
- Dose quantity correction with inventory recalculation deferred

## Deferred

- Native reminders (Phase 4)
- Shopping list & family management (Phase 5)
- Package scanning (Phase 6)
- Backup / restore (Phase 7)
- AppMetrica + РСЯ production SDKs (Phase 8)
- Final icon, RuStore screenshots, release keystore (Phase 9)

## Next checkpoint

Codex Phase 3 review, then Phase 4 — native reminders

## Last verified commit SHA

1dc66c657606e409da3c86450df31b909398ca0c
