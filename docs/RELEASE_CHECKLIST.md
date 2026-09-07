# Release checklist — Моя аптечка 1.0.0

Use before RuStore submission and after the final Codex release audit.

## Brand / icon

- [ ] Master artwork is `assets/icon_gpt.png` (unchanged unless intentional redesign)
- [ ] Installed Android app icon matches RuStore storefront `release-artifacts/rustore/icon.png`
- [ ] Adaptive icon: finished square as foreground + teal `#2A9D8F` background; monochrome omitted
- [ ] No Expo placeholder icons in production assets

## App identity

- [ ] Name: `Моя аптечка`
- [ ] Package: `com.calculatorplatform.pharmacy`
- [ ] versionName `1.0.0` / versionCode `1`
- [ ] Support email: `rustore-alex1c@yandex.ru`
- [ ] Privacy URL live: `https://alex1c.github.io/pharmacyRuStore/privacy.html`

## Privacy / data safety

- [ ] `docs/privacy.html` matches SDK reality (local data, AppMetrica, Yandex Ads, camera, notifications, backup)
- [ ] `docs/DATA_SAFETY.md` permissions list matches merged manifest
- [ ] Custom analytics events do not send medicine/person/raw codes
- [ ] No forbidden permissions (mic, location, contacts, phone, SMS, manage-external-storage)

## AppMetrica

- [ ] Production key `bbf42d5e-64b9-4a91-b4d0-766438bd07b3` active in release
- [ ] SDK initializes without crash
- [ ] Generic smoke event only (no PII)

## Ads (Yandex / РСЯ)

- [ ] Banner `R-M-19988985-1` on cabinet / shopping / more only
- [ ] Today / Приём / scanner / backup / forms / medical flows: no banner
- [ ] Interstitial `R-M-19988985-2`: ≥5 min, ≥5 meaningful actions, max 1/session; never medical-trigger
- [ ] Feed `R-M-19988985-3` disabled
- [ ] Release ads enabled; dev disable/demo path does not affect release
- [ ] **After store page exists:** add published RuStore URL in РСЯ cabinet → wait activation → verify blocks

## Notifications

- [ ] Permission requested in context
- [ ] Test / one real reminder delivery
- [ ] Tap opens Today
- [ ] Reminder sync does not duplicate

## Scanner

- [ ] Camera permission only when opening scanner
- [ ] Physical barcode smoke on a real device when available (otherwise deferred)

## Backup

- [ ] Create ZIP / share / restore smoke on device
- [ ] No upload to developer servers

## Build / signing

- [ ] Production keystore is **pharmacy-specific** (not reused from another app)
- [ ] Keystore + passwords **not** in Git
- [ ] Signed AAB present under `release-artifacts/` (local; `*.aab` gitignored)
- [ ] Signature verified with Android tooling
- [ ] versionName / versionCode / package correct in AAB

## RuStore assets

- [ ] `release-artifacts/rustore/icon.png`
- [ ] Screenshots `01`–`08` at **1080×1920**, ads/dev creatives not showcasing third-party ads
- [ ] `release-artifacts/rustore/description.txt`
- [ ] Category note: primary **Здоровье**; optional **Полезные инструменты**
- [ ] Age expectation: **0+** (confirm in RuStore UI)
- [ ] Search tag candidates only (pick real RuStore tags in UI): лекарства, аптечка, здоровье, напоминания, таблетки

## First-run cleanliness

- [ ] No demo medicines / screenshot fixtures in production seed
- [ ] Defaults: `Я` + `Дом`, empty cabinet
- [ ] No mandatory account
- [ ] No debug/dev-only UI in release

## Post-publish

1. Copy RuStore public app URL
2. Attach URL in Yandex Ads (РСЯ) application settings
3. Wait for activation
4. Verify banner/interstitial block status
