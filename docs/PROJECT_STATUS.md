# Project status

## Current phase

**Phase 9 — Final release / icon / RuStore assets / production QA**

## Status

**READY FOR FINAL CODEX RELEASE AUDIT**

Do **not** mark `READY FOR RUSTORE` until the separate final Codex release audit completes on the local machine.

## Completed

### Phase 0–8B
Foundation through backup, AppMetrica, and Yandex Ads (policy-aligned).

### Phase 9 (this checkpoint)
- Master icon `assets/icon_gpt.png` tracked as sole artwork source
- Android / adaptive / RuStore icons generated from master (master file not rewritten)
- Support email `rustore-alex1c@yandex.ru` + privacy GitHub Pages path
- DATA_SAFETY / RELEASE_CHECKLIST / store description
- Store screenshots `1080×1920` under `release-artifacts/rustore/screenshots/`
- Production signing keystore (local, gitignored) + release AAB workflow
- Static validation + release native build sanity

## Known issues / deferred

- Physical-device barcode scan QA if no USB device attached
- Extended Pixel API 37 notification matrix if emulator ANR limits apply
- After RuStore publish: attach public URL in РСЯ cabinet
- Archived medicine photos cleanup on disk
- Backup ZIP not encrypted
- Optional feed ads

## Next checkpoint

Final Codex release audit (run separately — not started by Phase 9 agent).

## Last verified commit SHA

(see `git rev-parse HEAD` after Phase 9 push)
