# Data safety notes (RuStore / store questionnaires)

Factual basis for future RuStore / Google Play data-safety answers.
**Do not invent final questionnaire answers without re-checking current SDK docs and the merged AndroidManifest.**

Phase covered: **8A — AppMetrica only**. Advertising SDK is **not** integrated yet.

## SDKs present

| SDK | Purpose | Phase |
| --- | --- | --- |
| `@appmetrica/react-native-analytics` 4.1.0 | Product / technical analytics | 8A |
| Yandex Mobile Ads / РСЯ | Advertising | **Not in 8A** (deferred to 8B) |

Native AppMetrica Android artifact (via the RN package): `io.appmetrica.analytics:analytics:8.0.0`.

## Production configuration

- API key (centralized): `bbf42d5e-64b9-4a91-b4d0-766438bd07b3`
- Config sources: `src/constants/analyticsConfig.ts`, `app.json` → `extra.analytics`
- Activation: once at cold bootstrap (`initializeAnalytics` in `useAppBootstrap`)
- Dev: AppMetrica reporting skipped unless `APPMETRICA_ENABLE_IN_DEV` is true
- Release: uses production key automatically
- App config flags used at activate: `locationTracking: false`, `advIdentifiersTracking: false`, `sessionsAutoTracking: true`, `appOpenTrackingEnabled: true`

## Custom events we send

Allowlisted generic product events only (see `src/services/analytics/events.ts`):

- `app_open`
- `medicine_created` (`source`: manual|scan)
- `batch_added` (`source`: manual|scan|shopping)
- `medicine_archived`
- `course_created` (`schedule_type`, `reminders_enabled`)
- `course_finished`
- `intake_taken` / `intake_skipped` / `intake_snoozed` (`minutes`)
- `scan_started` / `scan_success` (`code_type`) / `scan_failed`
- `shopping_item_added` (`source`) / `shopping_completed` (`type`)
- `backup_created` (`has_media`) / `backup_restored`
- `notification_permission_granted` / `notification_permission_denied`
- Screen views as `screen_view` + generic `screen` id

### Explicitly NOT sent in custom analytics

- Medicine names, dosage/strength text
- Person / family names
- Notes, custom shopping text
- GTIN / EAN / QR / DataMatrix raw values, serial, lot
- Photo URIs, cabinet/location display names
- Exact medical intake timestamps as event parameters
- Backup contents / intake history / notification payloads with medicine/person

Runtime allowlist drops unknown parameter keys even if a caller passes them.

## Technical data AppMetrica may collect

Per AppMetrica / Yandex mobile analytics documentation (verify before store submission):

- Device and app technical attributes (model, OS, app version, SDK version)
- Session / install / crash-related technical signals when enabled
- Network delivery of buffered events when connectivity is available

### Advertising ID

- AppMetrica Android SDK can depend on `io.appmetrica.analytics:analytics-identifiers` (GAID) by default in upstream docs.
- This app sets `advIdentifiersTracking: false` at activate time for Phase 8A product analytics.
- After each native prebuild/build, inspect the merged manifest for `com.google.android.gms.permission.AD_ID` and record the diff in the Phase report.
- Phase 8A applies Expo config plugin `plugins/withAppMetricaNoAdId.js` to **exclude** `io.appmetrica.analytics:analytics-identifiers` (official AppMetrica guidance when Advertising ID is not needed). Combined with `advIdentifiersTracking: false`.
- Re-verify the merged manifest after every SDK upgrade.

### Location / contacts / mic / SMS

- App activate uses `locationTracking: false`.
- Phase 8A must not introduce contacts / microphone / phone / SMS permissions for analytics.
- Camera permission remains only for the user-initiated scanner (expo-camera), unrelated to AppMetrica.
- AppMetrica ships `analytics-location*` library modules in the dependency tree, but the merged app manifest for the Phase 8A debug build did **not** declare `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`.

### Observed merged-manifest notes (Phase 8A debug assemble)

Present after AppMetrica integration (not previously asserted as “new vs old” line-by-line for every OEM badge permission from notifications):

- AppMetrica service + preload ContentProvider meta
- `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` (install referrer; AppMetrica attribution stack)
- Standard technical permissions already common in Expo apps: `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, notifications-related entries

**Not present:** `com.google.android.gms.permission.AD_ID`, location, contacts, microphone, phone, SMS.

## Permissions audit process

1. Capture `AndroidManifest.xml` permissions before AppMetrica (or from previous release notes).
2. Run `npx expo prebuild --platform android --clean` (or equivalent).
3. Diff merged app manifest / dependency manifests.
4. Record additions in this file and the Phase 8A report.

## Offline behaviour

- Core inventory / intake / shopping / backup features work offline.
- Analytics calls are fire-and-forget; UI never awaits network responses from AppMetrica.
- Analytics failures must not roll back business transactions.

## Ads (Phase 8B — not active)

Production ad unit IDs are reserved for the next phase and must not appear in this build:

- `R-M-19988985-1`
- `R-M-19988985-2`
- `R-M-19988985-3`
