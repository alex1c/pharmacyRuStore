# Local release report — Phase 9 (no passwords)

## Final Codex release audit — 2026-09-07

### Status

`FIXED — READY FOR RUSTORE UPLOAD`

### Source

- Starting SHA / expected: `15b74f3e82488231be523addfd7db8c4126c1b8a` on `main`.
- Final commit is the release-hardening commit shown by `git`; `origin/main` is verified after push.
- Working tree is clean after commit, except ignored local release/signing/build artifacts.

### AAB

- Path: `release-artifacts/pharmacy-1.0.0-v1.aab`
- Size: `94,271,035` bytes.
- SHA-256: `acd6cdec1c7b93bd30876596b4a0a0d2f55870363a8b677982556ccfeed46f08`
- Bundle manifest: package `com.calculatorplatform.pharmacy`, versionName `1.0.0`, versionCode `1`.
- Release SDK: min 24, compile/target 36.
- `jarsigner -verify`: `jar verified`; expected Gradle metadata warnings only.
- Certificate alias `pharmacy`; SHA-256 matches the approved fingerprint above.

### Release manifest

| Permission | Present | Expected |
|---|---:|---:|
| INTERNET | Yes | Yes |
| ACCESS_NETWORK_STATE | Yes | Yes |
| CAMERA | Yes | Yes |
| POST_NOTIFICATIONS | Yes | Yes |
| RECEIVE_BOOT_COMPLETED | Yes | Yes |
| SCHEDULE_EXACT_ALARM | Yes | Yes |
| AD_ID | Yes | Yes |
| VIBRATE / WAKE_LOCK | Yes | Yes |
| SYSTEM_ALERT_WINDOW | **No** | Absent |
| RECORD_AUDIO, location, contacts, phone/SMS, MANAGE_EXTERNAL_STORAGE | No | Absent |

`SYSTEM_ALERT_WINDOW` was removed from the production manifest through the reproducible Expo config plugin fix. It is absent from the generated bundle manifest, not merely from source assumptions.

### Icons and store assets

- Master `assets/icon_gpt.png`: 1254×1254.
- Embedded Android launcher resources are generated from the approved icon configuration; no Expo placeholder/dev-client icon is present.
- RuStore `release-artifacts/rustore/icon.png`: 1024×1024 PNG; same approved artwork and mask-safe composition.
- Screenshots `01`–`09`: all readable PNG, 1080×1920, 9:16; validation PASS and visual review found no desktop chrome, Metro UI, keyboard, permission dialog, fake feature, or third-party ad creative.

### Runtime and monetization

- `expo-dev-client`: removed from production dependency/config path; no Expo dev menu or Metro runtime dependency in the release bundle.
- AppMetrica production key is enabled for release; custom analytics excludes medicine/person/raw scan fields; `advIdentifiersTracking: false`.
- Yandex Ads: banner `R-M-19988985-1`, interstitial `R-M-19988985-2`; feed `R-M-19988985-3` disabled. Today remains ad-free; placement and interstitial thresholds are source-confirmed.
- First-run defaults and offline behavior remain covered by existing Phase QA; no registration or demo inventory is seeded. Notification/scanner/backup flows remain covered by prior verified smoke and tests; physical barcode scan was not repeated.

### Privacy and metadata

- `docs/privacy.html` exists; expected public URL: `https://alex1c.github.io/pharmacyRuStore/privacy.html`. HTTP availability could not be independently confirmed from this environment; enable GitHub Pages from `/docs` if it is not already enabled (metadata-only blocker).
- Support email is consistently `rustore-alex1c@yandex.ru`; old contact is absent.
- Description is Russian, feature-accurate, includes аптечка/остатки/сроки/напоминания/приём/покупки/семья/сканер/backup, and contains no diagnosis or treatment promise.
- `docs/DATA_SAFETY.md` matches actual release permissions and SDK behavior.

### Validation

| Check | Result |
|---|---|
| TypeScript | PASS |
| ESLint | PASS |
| Jest | PASS — 14 suites, 141 tests |
| Expo Doctor | NOT RUN — `npx` registry access returned EACCES; no local package installed |
| Release build | PASS — `bundleRelease` |
| AAB signature | PASS — jar verified; certificate matches |
| Manifest/security checks | PASS |
| Screenshot validation | PASS |
| Git clean / HEAD = origin/main | PASS after release commit and push |

### Finding fixed

| Severity | Area | Finding | Fix |
|---|---|---|---|
| High | Release manifest | `SYSTEM_ALERT_WINDOW` was present in the prior release path due to dev-client/native residue | Removed `expo-dev-client` and filtered the permission in `withAppMetricaNoAdId`; prebuild, release bundle, signature and manifest rechecked |

### Post-publish

- Add the public RuStore application URL to РСЯ and wait for activation/check status.

### Remaining non-blocking risk

- Expo Doctor was blocked by local `npx` registry EACCES; the build and all available local static checks passed.

## Signing certificate (public fingerprints)

- Alias: `pharmacy`
- Keystore path (local only): `keystore/pharmacy-release.jks`
- SHA1: `F3:5C:54:2B:9E:61:00:28:4F:01:50:9B:47:FE:26:AA:9C:D9:25:18`
- SHA256: `33:7C:AA:19:A0:6F:10:10:F4:1B:39:1A:F1:DE:AA:03:FC:27:35:65:53:C4:A0:11:6F:DD:87:FA:4B:48:99:31`

Passwords are **not** stored in this file. See gitignored `keystore/keystore.properties`.

## Expected AAB

- `release-artifacts/pharmacy-1.0.0-v1.aab` (gitignored binary)
- Package: `com.calculatorplatform.pharmacy`
- versionName: `1.0.0`
- versionCode: `1`
- Approximate size observed locally: ~90 MB
- `jarsigner -verify`: **jar verified** (self-signed production keystore; expected)
- APK `apksigner verify --print-certs`: SHA-256 matches keystore fingerprint above

## Store screenshots

- Path: `release-artifacts/rustore/screenshots/`
- Size: **1080×1920** (9:16), ads-free store compositions (no third-party creatives)
- Generated via `npm run screenshots:generate` / validated via `npm run screenshots:validate`
- Live Pixel_10 captures are 1080×2424 — not used as RuStore assets without letterbox crop
- Demo labels only; production first-run seed stays empty (`Я` + `Дом`)
