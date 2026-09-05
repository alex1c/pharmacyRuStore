# Project status

## Current phase

**Phase 8B — Production Yandex Ads** (complete after validation)

## Completed

### Phase 0–7
Foundation through backup/restore (schema v1–v7).

### Phase 8A
- AppMetrica production analytics, privacy-safe taxonomy, DATA_SAFETY baseline

### Phase 8B
- `yandex-mobile-ads` 8.4.0 integrated (native `mobileads:8.4.0`)
- Production banner `R-M-19988985-1` + interstitial `R-M-19988985-2`
- Feed `R-M-19988985-3` reserved/disabled
- Banner placements: cabinet, shopping, more, history
- Interstitial: delayed eligibility, max 1/session, medical exclusions
- Dev default: no production ad impressions
- Privacy / DATA_SAFETY / ADS_POLICY updated

## Known issues

- Archived medicine photos not deleted from disk yet
- Exact alarm special access may be denied on Android 14+ by default
- Physical-device barcode scan QA deferred
- Backup ZIP is not encrypted
- Production ad load QA deferred to device/release (avoid production impressions in Cursor)

## Deferred

- Phase 9 — final icon, RuStore screenshots, release build, production ad/device QA
- Extended native notification matrix
- Remote medicine catalogue enrichment
- Optional encrypted backup
- Feed ad format

## Next checkpoint

Phase 9 — release & assets (do not start until requested)

## Last verified commit SHA

(see git after Phase 8B push)
