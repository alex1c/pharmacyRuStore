# Project status

## Current phase

**Phase 4 — Native Android medication reminders** (complete)

## Completed

### Phase 0–3
See prior history: foundation, inventory, expiry/stock, courses/intake/history (schema v1–v4).

### Phase 4
- `expo-notifications` ~57.0.17 (local only, no push)
- Schema v5: `scheduled_notifications` ledger; `medication_courses.reminders_enabled`; setting `medication_reminders_enabled`
- Channel `medication-reminders`; 30-day rolling horizon; occurrence key sync
- Permission contextual prompt on fixed-schedule course save; Settings → Напоминания
- Reconciliation on startup / course mutations / intake / archive / permission grant
- Tap → Today; no background Taken/Snooze actions (correctness)
- `SCHEDULE_EXACT_ALARM` declared; `USE_EXACT_ALARM` not used
- Docs: `docs/NOTIFICATION_ARCHITECTURE.md`

## Known issues

- Archived medicine photos are not deleted from disk yet
- Exact alarm special access may be denied by default on Android 14+ (inexact fallback possible)
- Dose quantity correction with inventory recalculation deferred

## Deferred

- Shopping list & family management (Phase 5)
- Package scanning (Phase 6)
- Backup / restore (Phase 7)
- AppMetrica + РСЯ production SDKs (Phase 8)
- Final icon, RuStore screenshots, release keystore (Phase 9)

## Next checkpoint

Codex native Phase 4 review on Pixel_10 API 37

## Last verified commit SHA

64f314fac8551be3c85dfaa7b1eb728f9df04210
