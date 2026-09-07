# Data safety notes (RuStore / store questionnaires)

Factual basis for RuStore / Google Play data-safety answers.
**Do not invent final questionnaire answers without re-checking current SDK docs and the merged AndroidManifest.**

Phase covered: **9 — final release preparation**.

## Support / privacy contact

- Support email: `rustore-alex1c@yandex.ru`
- Public privacy page (GitHub Pages from `/docs`):  
  `https://alex1c.github.io/pharmacyRuStore/privacy.html`
- Source file: `docs/privacy.html`

## SDKs present

| SDK | Purpose | Phase |
| --- | --- | --- |
| `@appmetrica/react-native-analytics` 4.1.0 | Product / technical analytics | 8A |
| `yandex-mobile-ads` 8.4.0 | Banner + interstitial ads | 8B |
| `expo-camera` | Package barcode / QR / DataMatrix scan | core |
| `expo-notifications` | Local medication reminders | core |

Native artifacts (typical after prebuild):

- AppMetrica: `io.appmetrica.analytics:analytics:8.0.0`
- Yandex Mobile Ads: `com.yandex.android:mobileads:8.4.0`

## Ads production configuration

| Unit | ID | Status |
| --- | --- | --- |
| Banner | `R-M-19988985-1` | Enabled (cabinet / shopping / more) |
| Interstitial | `R-M-19988985-2` | Enabled (≥5 min, ≥5 actions, max 1/session) |
| Feed | `R-M-19988985-3` | Reserved / **disabled** in v1 |

- Config: `src/constants/adsConfig.ts`, `app.json` → `extra.ads`
- Init: once after DB ready (`initializeAds` in bootstrap) — non-blocking
- Dev default: ads disabled (no production impressions)
- Optional demo units: `demo-banner-yandex` / `demo-interstitial-yandex`
- Policy: `docs/ADS_POLICY.md`

The app does **not** pass medicine names, person names, scan codes, or intake contents into the advertising layer.

## AppMetrica configuration

- API key: `bbf42d5e-64b9-4a91-b4d0-766438bd07b3`
- Active in release builds
- `advIdentifiersTracking: false`, `locationTracking: false`
- Plugin `withAppMetricaNoAdId` excludes AppMetrica `analytics-identifiers`
- Custom events never include medicine/person/raw barcode payloads

## Expected merged permissions (release)

Present / expected:

| Permission | Source / note |
| --- | --- |
| `INTERNET` | Network (AppMetrica, Ads) |
| `ACCESS_NETWORK_STATE` | Network state |
| `CAMERA` | Scanner only (`expo-camera`) |
| `POST_NOTIFICATIONS` | Reminders (Android 13+) |
| `RECEIVE_BOOT_COMPLETED` | Reschedule after reboot |
| `SCHEDULE_EXACT_ALARM` | Exact reminder timing (declared in `app.json`) |
| `AD_ID` (`com.google.android.gms.permission.AD_ID`) | Yandex Mobile Ads |
| `VIBRATE` / `WAKE_LOCK` | Notifications / Play services |
| `SYSTEM_ALERT_WINDOW` | Absent; dev-client is not part of the production dependency/config path |
| OEM badge permissions | From `expo-notifications` badge helpers |

Confirmed **absent** (must stay absent unless product need changes):

- `RECORD_AUDIO`
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- contacts / phone / SMS
- `MANAGE_EXTERNAL_STORAGE`

## Advertising ID

- AppMetrica GAID module remains excluded via `withAppMetricaNoAdId`.
- **Yandex Mobile Ads** declares `com.google.android.gms.permission.AD_ID`.
- Do **not** remove `AD_ID` for ads — required for monetization stack.

## Offline behaviour

- Core app works offline (inventory, Today, intake, shopping, local backup UI).
- Banner/interstitial simply absent without network.
- Ads / AppMetrica must not crash startup when offline.

## First-run defaults (no demo catalogue)

- Person: `Я`
- Cabinet: `Дом`
- Empty medicine inventory
- No mandatory registration
- Camera / notification permissions requested in context (scanner / reminders), not on cold start without reason

## RuStore / РСЯ activation note (post-publish)

1. Copy published RuStore app URL
2. Attach it in the Yandex Ads (РСЯ) cabinet for this app
3. Wait for activation
4. Re-check block statuses

This is **not** a blocker for AAB upload.
