# Project status

## Current phase

**Phase 8A — Production AppMetrica** (complete)

## Completed

### Phase 0–7
Foundation through backup/restore (schema v1–v7).

### Phase 8A
- `@appmetrica/react-native-analytics` 4.1.0 integrated (Expo SDK 57 / RN 0.86)
- Production API key centralized (`src/constants/analyticsConfig.ts` + `app.json` extra)
- One-time activation at cold bootstrap; analytics failures never block app/business flows
- Typed privacy-safe event taxonomy + runtime parameter allowlist
- Screen tracking with consecutive-dedupe; single `app_open` per cold start
- Privacy docs updated; `docs/DATA_SAFETY.md` prepared for RuStore questionnaires
- Ads / РСЯ still deferred to Phase 8B

## Phase 4 note

Functional native reminders confirmed in prior checkpoint; extended native matrix deferred to final release QA.

## Known issues

- Archived medicine photos not deleted from disk yet
- Exact alarm special access may be denied on Android 14+ by default
- Physical-device barcode scan QA deferred
- Backup ZIP is not encrypted

## Deferred

- Yandex Mobile Ads / РСЯ (Phase 8B)
- Final icon / screenshots / release signing (Phase 9)
- Extended native notification matrix
- Remote medicine catalogue enrichment
- Optional encrypted backup

## Next checkpoint

Phase 8B — Yandex Ads production integration (do not start until requested)

## Last verified commit SHA

(see git after Phase 8A push)

## Permissions note (Phase 8A build)

Merged debug manifest after AppMetrica: no `AD_ID`, location, contacts, mic, phone, or SMS.
AppMetrica-related additions observed: `AppMetricaService` / preload ContentProvider, install-referrer binder permission (Finsky), plus standard network state usage via analytics stack.
Advertising-identifiers module excluded via `withAppMetricaNoAdId` plugin.
