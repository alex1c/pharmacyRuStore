# Privacy review notes (pre-release)

Checklist to re-verify before RuStore publication after AppMetrica / РСЯ are connected.

## Must update

- [ ] Replace Phase 0 draft wording in `docs/privacy.html` with final legal text
- [ ] Add support contact once support email is confirmed
- [ ] Document exact analytics events and whether they include medicine names (prefer not)
- [ ] Document ad SDK data practices and link partner policies
- [ ] Confirm age rating / sensitive category disclosures for RuStore
- [ ] Confirm whether ATT / advertising ID disclosures are required for the chosen SDKs
- [ ] Ensure no production API keys are hardcoded in the repository
- [ ] Ensure `.env` / keystore / signing materials are gitignored and not uploaded

## Product policy reminders

- Ads: one unobtrusive banner on suitable main screens
- No interstitial right after launch
- No interstitial during intake confirmation
- Offline core features must keep working if ads/analytics fail

## Camera & scanning (Phase 6)

- Camera is used **only** for barcode/QR/DataMatrix scanning after the user opens the scanner
- Scanned codes (including GTIN / lot / serial) stay **local** in SQLite
- Analytics must not include raw codes, GTIN, serial, or medicine names (`scan_success` / `scan_failed` only)
- No upload of scanned codes to external services in the current version
- Gallery photo pick for medicine images remains separate from scanner camera permission

## Backup (Phase 7)

- Backup ZIP is created **locally**; the app does not upload it to any server
- The user chooses where to save or send the file (system share / document picker)
- The file may contain sensitive household medicine and intake information
- Backup is **not encrypted** — store it in a safe place
- No analytics/ad device identifiers are included in backups

## Do not claim until true

- Cloud sync
- Account registration
- Transmission of medicine lists to our servers
- Medical advice / diagnosis capabilities
- Remote medicine catalogue / Честный знак live lookup
- Encrypted / password-protected backup
