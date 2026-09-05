# Data safety notes (RuStore / store questionnaires)

Factual basis for future RuStore / Google Play data-safety answers.
**Do not invent final questionnaire answers without re-checking current SDK docs and the merged AndroidManifest.**

Phase covered: **8B — AppMetrica + Yandex Mobile Ads**.

## SDKs present

| SDK | Purpose | Phase |
| --- | --- | --- |
| `@appmetrica/react-native-analytics` 4.1.0 | Product / technical analytics | 8A |
| `yandex-mobile-ads` 8.4.0 | Banner + interstitial ads | 8B |

Native artifacts:

- AppMetrica: `io.appmetrica.analytics:analytics:8.0.0`
- Yandex Mobile Ads: `com.yandex.android:mobileads:8.4.0`

## Ads production configuration

| Unit | ID | Status |
| --- | --- | --- |
| Banner | `R-M-19988985-1` | Enabled |
| Interstitial | `R-M-19988985-2` | Enabled (1/session policy) |
| Feed | `R-M-19988985-3` | Reserved / **disabled** in v1 |

- Config: `src/constants/adsConfig.ts`, `app.json` → `extra.ads`
- Init: once after DB ready (`initializeAds` in bootstrap) — non-blocking
- Dev default: ads disabled (no production impressions)
- Optional demo units: `demo-banner-yandex` / `demo-interstitial-yandex`
- Policy: `docs/ADS_POLICY.md`

The app does **not** pass medicine names, person names, scan codes, or intake contents into the advertising layer.

## AppMetrica configuration

- API key: `bbf42d5e-64b9-4a91-b4d0-766438bd07b3`
- `advIdentifiersTracking: false`, `locationTracking: false`
- Plugin `withAppMetricaNoAdId` excludes AppMetrica `analytics-identifiers`

## Custom analytics events (incl. ads)

Allowlisted events in `src/services/analytics/events.ts`, including:

- product events from Phase 8A
- `ad_banner_loaded` / `ad_banner_failed` (`placement`, `format`)
- `ad_interstitial_loaded` / `ad_interstitial_shown` / `ad_interstitial_failed` (`format`)

Never: creative text, advertiser, click URLs, medicine/person/scan payloads.

## Advertising ID (Phase 8B — verified)

- AppMetrica GAID module remains excluded via `withAppMetricaNoAdId`.
- **Yandex Mobile Ads** merged debug build **declares** `com.google.android.gms.permission.AD_ID`.
- Also present: Yandex `AdActivity`, `YandexAdsInitializeProvider`.
- Do **not** remove `AD_ID` for ads — required for monetization stack.
- No location / contacts / microphone / phone / SMS permissions added for ads.

### Merged-manifest delta vs Phase 8A (ads-related)

Added with Yandex Mobile Ads:

- `com.google.android.gms.permission.AD_ID`
- `com.yandex.mobile.ads.common.AdActivity`
- `com.yandex.mobile.ads.core.initializer.YandexAdsInitializeProvider`
- debug panel activities/providers (SDK)

Unchanged dangerous set: still no `ACCESS_FINE_LOCATION`, contacts, mic, phone, SMS.

## Permissions audit process

1. Capture previous merged permissions baseline.
2. `npx expo prebuild --platform android`
3. `assembleDebug` (or equivalent) and inspect merged manifest + dependency tree.
4. Update this file with factual AD_ID / network / referrer findings.

## Offline behaviour

- Core app works offline.
- Banner/interstitial simply absent without network.
- Ads never block startup or business transactions.

## RuStore / РСЯ activation note

Until the published RuStore URL is attached in the Yandex Ads cabinet, the app may remain in a partner “test” status. This does not block code integration; add the URL in Phase 9 release checklist.
