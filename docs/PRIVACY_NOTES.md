# Privacy review notes

Checklist before RuStore publication. Phase 8A: AppMetrica connected; ads still deferred.

## Must update before store release

- [x] Document AppMetrica usage in `docs/privacy.html`
- [ ] Add support contact once support email is confirmed
- [x] Document that custom analytics events do **not** include medicine/person names or raw codes
- [ ] Document ad SDK data practices when Phase 8B lands
- [ ] Confirm age rating / sensitive category disclosures for RuStore
- [x] Note Advertising ID / AppMetrica identifier behaviour in `docs/DATA_SAFETY.md`
- [x] Production AppMetrica API key is centralized (`src/constants/analyticsConfig.ts` + `app.json` extra)
- [ ] Ensure `.env` / keystore / signing materials are gitignored and not uploaded

## Product policy reminders

- Ads: one unobtrusive banner on suitable main screens (Phase 8B)
- No interstitial right after launch
- No interstitial during intake confirmation
- Offline core features must keep working if ads/analytics fail

## Camera & scanning

- Camera is used **only** for barcode/QR/DataMatrix scanning after the user opens the scanner
- Scanned codes (including GTIN / lot / serial) stay **local** in SQLite
- Analytics may send `scan_success` with generic `code_type` only — never raw codes, GTIN, serial, or medicine names
- No upload of scanned codes to external services in the current version
- Gallery photo pick for medicine images remains separate from scanner camera permission

## Backup

- Backup ZIP is created **locally**; the app does not upload it to any server
- The user chooses where to save or send the file (system share / document picker)
- The file may contain sensitive household medicine and intake information
- Backup is **not encrypted** — store it in a safe place
- No analytics/ad device identifiers are included in backups
- Analytics may send `backup_created` / `backup_restored` without medical entity payloads

## Analytics (Phase 8A)

- Provider: AppMetrica (`@appmetrica/react-native-analytics`)
- Custom events are allowlisted and sanitized in `src/services/analytics/`
- Development builds log events locally and do not activate production reporting by default
- Release builds use the production API key automatically

## Do not claim until true

- Cloud sync
- Account registration
- Transmission of medicine lists to developer servers
- Medical advice / diagnosis capabilities
- Remote medicine catalogue / Честный знак live lookup
- Encrypted / password-protected backup
- «Никакие данные не передаются наружу» — false once AppMetrica is active
