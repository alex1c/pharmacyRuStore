# Privacy review notes

Checklist before RuStore publication. Phase 8B: AppMetrica + Yandex Mobile Ads connected.

## Must update before store release

- [x] Document AppMetrica usage in `docs/privacy.html`
- [x] Document Yandex Mobile Ads / РСЯ usage in `docs/privacy.html`
- [ ] Add support contact once support email is confirmed
- [x] Document that custom analytics events do **not** include medicine/person names or raw codes
- [x] Document ad SDK presence and that medicine/person/scan values are not passed into the advertising layer by the app
- [ ] Confirm age rating / sensitive category disclosures for RuStore
- [x] Note Advertising ID behaviour for analytics vs ads in `docs/DATA_SAFETY.md`
- [x] Production AppMetrica / Ads IDs are centralized
- [ ] Ensure `.env` / keystore / signing materials are gitignored and not uploaded
- [ ] After RuStore URL exists: attach it in Yandex Ads cabinet (see `docs/ADS_POLICY.md`)

## Product policy reminders

- Ads: one unobtrusive banner on cabinet / shopping / more / history
- No banner on Today / medical forms / scanner / backup
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

- Provider: `yandex-mobile-ads` (native Yandex Mobile Ads SDK)
- Production banner / interstitial IDs configured; feed reserved disabled
- Dev default: ads off (no production impressions)
- Optional demo units via `ADS_ENABLE_DEMO_IN_DEV`

## Do not claim until true

- Cloud sync / accounts
- Transmission of medicine lists to developer servers
- Medical advice / diagnosis
- Encrypted backup
- «Никакие данные не передаются наружу»
- «Advertising SDK collects nothing»
