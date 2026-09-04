# Date & Time Strategy

This document defines how «Моя аптечка» stores and interprets dates and times.

## Goals

- Avoid timezone shifts for expiry dates and calendar days
- Keep absolute event times unambiguous
- Leave room for local intake schedules (`HH:mm`) without premature complexity

## Instant timestamps

**Use for:** `createdAt`, `updatedAt`, intake confirmation moments, audit events.

**Storage format:** ISO-8601 UTC string, e.g. `2026-09-04T09:15:30.123Z`

**Runtime helper:** `nowIso()` in `src/utils/dates.ts`

Why UTC:
- Stable across device timezone changes
- Easy to sort and compare
- Standard for SQLite TEXT timestamps in this project

## Calendar dates (date-only)

**Use for:** purchase date, opened-on date, schedule day anchors.

**Storage format:** `YYYY-MM-DD` as TEXT — never as a UTC midnight timestamp.

Example: `2028-05-12`

**Validation:** `isDateOnly()`

Why not `Date` / UTC midnight:
- `new Date('2028-05-12')` is interpreted as UTC midnight in many engines
- On UTC+3 / UTC-5 devices this can become the previous or next local day
- Expiry and “take on this day” semantics are calendar concepts, not instants

## Year-month expiry

**Use for:** package expiry printed as month/year (`05.2028`, `2028-05`).

**Storage format:** `YYYY-MM` TEXT

Example: `2028-05` must remain `2028-05` regardless of timezone.

**Validation:** `isYearMonth()`

Do **not** store expiry as:
- Unix epoch
- `2028-05-01T00:00:00.000Z`
- Locale-dependent strings like `05.2028` in the database

Locale formatting belongs in the UI layer only.

## Local schedule times

**Future use for:** daily intake times such as `08:00`, `21:30`.

**Storage format:** `HH:mm` TEXT (24-hour, local wall clock)

**Validation:** `isLocalTimeHm()`

Notes:
- These are local civil times, not UTC offsets
- Timezone ID may be stored later at household/device settings level if needed
- Reminder scheduling (Phase 4) will convert local `HH:mm` + calendar date into a fire instant using the device timezone at runtime

## Summary table

| Concept | DB type | Example | Timezone sensitive? |
| --- | --- | --- | --- |
| Instant | TEXT ISO UTC | `2026-09-04T09:15:30.123Z` | Stored in UTC |
| Date-only | TEXT `YYYY-MM-DD` | `2028-05-12` | No |
| Expiry month | TEXT `YYYY-MM` | `2028-05` | No |
| Schedule clock | TEXT `HH:mm` | `08:00` | Local wall clock |

## Domain reminder

`medicine !== batch`

Expiry and remaining quantity belong to a **batch/package**, not to the logical medicine entity. Date fields for expiry must therefore live on batch records in Phase 1+.
