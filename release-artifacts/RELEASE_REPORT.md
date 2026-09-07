# Local release report — Phase 9 (no passwords)

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
