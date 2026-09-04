# Моя аптечка

Домашний менеджер лекарств для всей семьи. Android-first приложение для RuStore.

**Не является медицинской консультацией.** Приложение помогает вести учёт лекарств и расписание приёма, но не ставит диагнозы и не заменяет врача или фармацевта.

## Repository

- Working directory (remote Cursor): `D:\PetProject\pharmacyRuStore`
- GitHub: https://github.com/alex1c/pharmacyRuStore
- Default branch: `main`
- Android package: `com.calculatorplatform.pharmacy`
- Version: `1.0.0` (versionCode `1`)

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- Expo Router (tabs)
- Expo SQLite
- Jest + ESLint
- Android / RuStore oriented (dev client / native builds)

## Main commands

```bash
npm install
npm start
npm run android
npm run lint
npm run typecheck
npm test
npm run doctor
npm run check
```

## Architecture overview

```
src/
  app/                 # Expo Router screens (5 tabs)
  components/ui/       # Reusable UI primitives
  constants/           # Design tokens + Russian copy
  context/             # Database provider
  db/                  # SQLite, migrations, repositories
  hooks/               # Bootstrap / feature hooks
  services/            # Analytics + ads abstractions
  utils/               # Dates, locale decimals, ids
docs/                  # Privacy, date strategy, project status
```

### Startup flow

1. App launches
2. SQLite opens (`pharmacy.db`)
3. Migrations apply
4. First-run defaults seed (`Я`, `Дом`, household)
5. Tab UI becomes available
6. DB errors show a Russian fallback (no white screen)

### Navigation

1. Сегодня
2. Аптечка
3. Приём
4. Покупки
5. Ещё

### Database migrations

- Migrations live in `src/db/migrations/`
- Version registry: `schema_migrations`
- Apply via `applyMigrations()` during bootstrap
- Never edit already-shipped migration SQL — append a new version

Phase 0 tables: `households`, `people`, `medicine_cabinets`, `app_meta`, `schema_migrations`

Critical domain rule for later phases: **medicine ≠ package/batch**.

## Git workflow

- GitHub `main` is the source of truth
- Prefer small focused commits
- Never commit secrets, keystores, `.env` with keys, or release binaries
- Push to `origin/main` after verified Phase checkpoints

## Roadmap

| Phase | Focus |
| --- | --- |
| Phase 0 | Foundation (current) |
| Phase 1 | Аптечка / лекарства / партии |
| Phase 2 | Сроки / остатки |
| Phase 3 | Курсы и приём |
| Phase 4 | Native reminders |
| Phase 5 | Покупки и семья |
| Phase 6 | Scanning |
| Phase 7 | Backup / restore |
| Phase 8 | Ads + AppMetrica |
| Phase 9 | Release |

## Current status

See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

Phase 0 delivers the production-oriented foundation only — no full medicine CRUD yet.
