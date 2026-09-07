# Ads policy (Phase 8B / v1.0)

Monetization with Yandex Mobile Ads (РСЯ) without interfering with medication flows.

## Production IDs

| Format | Unit ID | v1.0 status |
| --- | --- | --- |
| Banner | `R-M-19988985-1` | Enabled |
| Interstitial | `R-M-19988985-2` | Enabled (strict policy) |
| Feed | `R-M-19988985-3` | **Reserved / disabled** — not integrated |

Central config: `src/constants/adsConfig.ts`, `app.json` → `extra.ads`.

## Banner placements (enabled)

- **Аптечка** (`cabinet`)
- **Покупки** (`shopping`)
- **Ещё** (`more`)

Max **one** visible banner per screen.

## No banner

- **Сегодня** (Today)
- **Приём** (including history segment)
- Medicine / batch / course / person create & edit forms
- Scanner / camera / scan result
- Shopping purchase forms
- Backup / restore
- Permission / notification settings
- Confirmation dialogs, modals, error / onboarding screens

## Interstitial

Eligibility (all required):

- `sessionAge >= 5 minutes`
- `meaningfulActionCount >= 5`
- `interstitialShown == false` (max **1 / session**)
- interstitial ad ready

Meaningful actions (examples): medicine/batch saved, shopping manual add, shopping purchase completed, cabinet/location saved.

**Not counted / never trigger:** intake taken / skipped / snooze / PRN / undo, notification tap/open, course create/edit, scanner, backup/restore, permission flows.

### Allowed try-show points (after successful business work)

- After medicine / batch save when back on a calm inventory path
- After shopping purchase completed on Shopping list
- After cabinet / location save

Preload may run after quiet SDK init; preload does **not** grant show rights.

## Medical exclusions

Never show interstitial before/after `Принял`, `Пропустить`, snooze, PRN, notification reminder open, or during medication confirmation UX.

## Dev policy

| Runtime | Behaviour |
| --- | --- |
| `__DEV__` default | Ads **disabled** — no production impressions |
| `__DEV__` + `ADS_ENABLE_DEMO_IN_DEV` | Official demo units only |
| Release | Production units automatic |

## Analytics (AppMetrica)

Generic only: `ad_banner_loaded` / `ad_banner_failed` / `ad_interstitial_*` with `placement` ∈ {cabinet, shopping, more} and `format`.

Never medicine/person/codes/creative/URLs.

## RuStore / РСЯ activation

Until the published RuStore URL is attached in the Yandex Ads cabinet, partner status may stay “test”. Not a code blocker.

Release checklist:

1. Obtain RuStore app URL
2. Add URL in РСЯ app settings
3. Confirm activation / block status
4. Device production ad load check
