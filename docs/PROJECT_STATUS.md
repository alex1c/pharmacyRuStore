# Project status

## Current phase

**Phase 5 — Покупки и семья** (complete)

## Completed

### Phase 0–4
Foundation, inventory, expiry/stock, courses/intake, native local reminders (schema v1–v5).

### Phase 5
- Schema v6: `people.note`, `people.archived_at`; `shopping_items` + partial unique automatic medicine index
- Family CRUD (Ещё → Члены семьи); default «Я» protected; archive finishes courses, keeps history
- Person filter on Приём / History; Today hides default name
- Automatic shopping from low/empty stock (idempotent sync); recovery → completed
- Manual medicine + custom items; purchase → new batch (no duplicate Medicine)
- Shopping tab + badge; medicine detail shopping actions
- Intake taken/undo syncs shopping list

## Phase 4 note

Functional native reminders confirmed in prior checkpoint; extended native matrix deferred to final release QA.

## Known issues

- Archived medicine photos not deleted from disk yet
- Exact alarm special access may be denied on Android 14+ by default

## Deferred

- Scanner (Phase 6)
- Backup / restore (Phase 7)
- AppMetrica + ads (Phase 8)
- Final icon / screenshots / release signing (Phase 9)
- Extended native notification matrix

## Next checkpoint

Phase 6 — medicine scanning and fast entry

## Last verified commit SHA

(pending Phase 5 commit)
