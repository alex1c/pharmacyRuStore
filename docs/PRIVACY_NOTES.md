# Privacy review notes

Checklist before RuStore publication. Phase 9: support contact + privacy URL finalized.

## Must update before store release

- [x] Document AppMetrica usage in `docs/privacy.html`
- [x] Document Yandex Mobile Ads / РСЯ usage in `docs/privacy.html`
- [x] Support contact: `rustore-alex1c@yandex.ru`
- [x] Public privacy URL: `https://alex1c.github.io/pharmacyRuStore/privacy.html` (repo `/docs` → GitHub Pages)
- [x] Document that custom analytics events do **not** include medicine/person names or raw codes
- [x] Document ad SDK presence and that medicine/person/scan values are not passed into the advertising layer by the app
- [x] Age expectation documented as **0+** (final choice in RuStore UI)
- [x] Note Advertising ID behaviour for analytics vs ads in `docs/DATA_SAFETY.md`
- [x] Production AppMetrica / Ads IDs are centralized
- [x] Keystore / signing materials gitignored (`keystore/`, `*.jks`, `*.aab`)
- [ ] After RuStore URL exists: attach it in Yandex Ads cabinet (see `docs/ADS_POLICY.md`)

## Product policy reminders

- Ads: one unobtrusive banner on cabinet / shopping / more
- No banner on Today / Приём / medical forms / scanner / backup
- No interstitial right after launch
- No interstitial during / after intake confirmation
- Offline core features must keep working if ads/analytics fail
- See [`docs/ADS_POLICY.md`](ADS_POLICY.md)

## Camera & scanning

- Camera is used **only** for barcode/QR/DataMatrix scanning after the user opens the scanner
- Scanned codes stay **local** in SQLite
- Analytics may send `scan_success` with generic `code_type` only
- Ads are not shown on scanner / scan result screens
- No upload of scanned codes to external services in the current version

## Backup

- Backup ZIP is created **locally**; the app does not upload it to any server
- Backup / restore screens have **no ads**
- Backup is **not encrypted**

## Analytics (Phase 8A+)

- Provider: AppMetrica
- Custom events allowlisted and sanitized
- Ad technical events are generic (`ad_banner_*`, `ad_interstitial_*`) only

## Ads (Phase 8B)

- Provider: `yandex-mobile-ads` **8.4.0** (native `com.yandex.android:mobileads:8.4.0`)
- Production banner / interstitial IDs configured; feed reserved disabled
- Banners: cabinet / shopping / more only (not Today / Приём)
- Interstitial: ≥5 min session, ≥5 meaningful actions, max 1/session
- Dev default: ads off (no production impressions)
- Optional demo units via `ADS_ENABLE_DEMO_IN_DEV`
- Merged manifest includes `com.google.android.gms.permission.AD_ID` from Yandex Ads (kept)
- See [`docs/ADS_POLICY.md`](ADS_POLICY.md) and [`docs/DATA_SAFETY.md`](DATA_SAFETY.md)

## Do not claim until true

- Cloud sync / accounts
- Transmission of medicine lists to developer servers
- Medical advice / diagnosis
- Encrypted backup
- «Никакие данные не передаются наружу»
- «Advertising SDK collects nothing»
