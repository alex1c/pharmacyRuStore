# Ads policy (Phase 8B)

Monetization with Yandex Mobile Ads (РСЯ) without interfering with medication flows.

## Production units

| Format | Unit ID | v1.0 status |
| --- | --- | --- |
| Banner | `R-M-19988985-1` | Enabled |
| Interstitial | `R-M-19988985-2` | Enabled (strict policy) |
| Feed | `R-M-19988985-3` | **Reserved / disabled** — not integrated |

Central config: `src/constants/adsConfig.ts`, `app.json` → `extra.ads`.

## Banner placements (enabled)

- **Аптечка** (`cabinet`) — bottom, below list / above tab bar area
- **Покупки** (`shopping`) — bottom
- **Ещё** (`more`) — bottom
- **Приём → История** (`history`) — bottom of history segment only

## Banner placements (disabled)

- Сегодня (Today) — schedule priority; no banner
- Active courses / PRN take actions on Приём
- Medicine / batch / course create & edit forms
- Scanner + scan result
- Backup / restore
- Reminders settings / permission dialogs
- Family edit, error screens, modals, keyboard overlays

Max **one** visible banner per screen. Never two ad blocks at once.

## Interstitial policy

- Max **1 per cold app session**
- Minimum session age: **3 minutes**
- Minimum meaningful non-medical actions: **4**
- Cooldown abstraction: **10 minutes** between shows (future-proof; rarely hits with 1/session)
- After medication notification open: blocked for **5 minutes**
- Preload after quiet SDK init; never block startup
- If not ready / failed → continue user flow silently

### Eligible triggers (after successful secondary flow)

- Medicine created / edited
- Batch created / edited
- Shopping purchase completed (returned to list)
- Cabinet / storage location saved

### Never trigger interstitial

- Intake taken / skipped / snoozed
- Notification tap / open-from-reminder
- Cold start / first action / immediately after launch
- Scanner / scan result
- Backup / restore
- Permission prompts
- While keyboard or modal is open

Medical actions do **not** increase eligibility counters.

## Dev / release

| Runtime | Behaviour |
| --- | --- |
| `__DEV__` default | Ads **disabled** — no production impressions |
| `__DEV__` + `ADS_ENABLE_DEMO_IN_DEV=true` | Official demo units (`demo-banner-yandex`, `demo-interstitial-yandex`) |
| Release | Production units automatically |

Do not QA with production impressions on developer machines.

## Medical safety UX

- Ads must not sit next to `Принял` / stock urgency / medicine+CTA clusters
- No “Рекомендуем” copy near ads
- Spacing separates inventory content from the banner strip
- Ad failure never rolls back purchases, intake, or backup

## Analytics (AppMetrica)

Generic only:

- `ad_banner_loaded` / `ad_banner_failed` — `placement`, `format=banner`
- `ad_interstitial_loaded` / `ad_interstitial_shown` / `ad_interstitial_failed` — `format=interstitial`

Never send creative text, advertiser, click URLs, medicine/person/scan payloads.

## Release checklist (post-RuStore)

- [ ] Confirm production banner/interstitial load on a real device
- [ ] Add published RuStore app URL in Yandex Ads app settings
- [ ] Confirm РСЯ app status leaves “test” after store link
- [ ] Re-check merged manifest `AD_ID` declaration for store questionnaire
- [ ] Final icon / screenshots / signing (Phase 9)
