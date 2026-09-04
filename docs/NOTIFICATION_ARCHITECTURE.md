# Notification architecture (Phase 4)

Local Android medication reminders for «Моя аптечка». No Expo Push / FCM / server.

## Source of truth

SQLite courses + schedules + intake records remain the source of truth.

Native scheduled notifications are a derived cache:

`DB occurrences → syncMedicationReminders() → native DATE triggers + scheduled_notifications ledger`

If native reminders are lost, startup reconciliation recreates them from DB.

## Library

- `expo-notifications` (SDK 57 compatible, installed via `npx expo install`)
- Local notifications only — **no** push tokens

## Channel

- ID: `medication-reminders`
- Name: `Напоминания о лекарствах`
- Importance: HIGH
- Default system sound + light vibration

## Horizon

**30 calendar days** ahead (`REMINDER_HORIZON_DAYS`).

Occurrences beyond the horizon are not scheduled; later startups bring them into range.

## Occurrence identity

`scheduleId|YYYY-MM-DD|HH:mm` — shared with intake uniqueness.

PRN courses never schedule native reminders.

## Reconciliation

`syncMedicationReminders(db, householdId)`:

1. Ensure channel
2. If permission not granted **or** global `medication_reminders_enabled=0` → cancel ledger + return
3. Compute desired future triggers from schedule engine + intake status
4. Cancel stale ledger/native IDs
5. Create/update missing or changed triggers
6. Idempotent on repeat

Runs after: startup (non-fatal), course create/edit/finish, medicine archive, intake taken/skip/snooze/undo, permission grant, global toggle.

## Ledger

Table `scheduled_notifications`:

- `occurrence_key` UNIQUE
- `native_notification_id` (exact ID from `scheduleNotificationAsync`)
- `trigger_at` ISO UTC of fire time

Failed native schedule → no ledger success row (retry on next sync).

## Permissions

- Runtime `POST_NOTIFICATIONS` (Android 13+) via Expo permission APIs
- Prompt context: first fixed-schedule course save («Разрешить / Не сейчас»)
- Startup never auto-prompts
- Settings → Напоминания: status, request, open system settings, test ping (~10s)
- Course field `reminders_enabled` + global `medication_reminders_enabled`

## Exact alarms

- Config includes `android.permission.SCHEDULE_EXACT_ALARM` (not `USE_EXACT_ALARM`)
- Needed for Expo DATE triggers that use exact alarm APIs on Android 12+
- Android 14+ may deny special access by default — app must not crash; reminders may drift inexact until user grants «Alarms & reminders»
- No custom native module for special-access UX in Phase 4

## Timezone / DST

Triggers built with `new Date(y, m-1, d, h, min)` from `YYYY-MM-DD` + `HH:mm` (local wall clock).

Startup reconciliation rebuilds desired triggers after timezone change.

## Snooze

In-app +10/+30/+60:

- Intake `snoozed` + `snoozedUntil`
- Sync cancels original fire time and schedules the same `occurrenceKey` at snooze instant

## Taken / skipped / undo

- Taken/skipped → reminder cancelled; sync will not recreate
- Undo → recreate only if trigger is still in the future

## Course edit / archive

- Schedule replace → old future IDs cancelled, new ones created; history untouched
- Finish/archive course or archive medicine → future reminders cancelled; history/movements remain

## Notification actions (Phase 4)

| Action | Status |
| --- | --- |
| Tap → open Today | Implemented |
| Background «Принял» | **Not** implemented (correctness: avoid SQLite intake in unreliable headless path) |
| Background «Отложить» | **Not** implemented (same reason; in-app snooze remains) |

## Reboot / force-stop

- Relies on `expo-notifications` `RECEIVE_BOOT_COMPLETED` reschedule behavior
- Force-stop Android limitations are OS-defined; documented for native QA, no fake workaround
- App restart always reconciles from DB

## Permissions audit (expected)

| Permission | Present | Notes |
| --- | --- | --- |
| `POST_NOTIFICATIONS` | yes (library) | Android 13+ |
| `RECEIVE_BOOT_COMPLETED` | yes (library) | Boot reschedule |
| `SCHEDULE_EXACT_ALARM` | yes (app.json) | Exact DATE triggers |
| `USE_EXACT_ALARM` | **no** | Intentionally omitted |
| Gallery (image picker) | yes (Phase 1) | Photos |
| Location / mic / contacts / SMS | **no** | |

## Known Android risks for Codex Pixel QA

1. Exact alarm special access on API 34+
2. Emulator reboot survival of scheduled locals
3. Force-stop delivery behavior
4. Development build (not Expo Go) required for reliable local scheduling
