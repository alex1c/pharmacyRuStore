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
  app/                 # Expo Router screens (tabs + inventory flows)
  components/ui/       # Reusable UI primitives
  constants/           # Design tokens, forms, units, copy
  context/             # Database provider
  db/                  # SQLite, migrations, repositories
  domain/              # Aggregation helpers (medicine ≠ batch)
  hooks/               # Bootstrap / feature hooks
  services/            # Analytics, ads, medicine media
  utils/               # Dates, expiry, locale decimals, quantity
docs/                  # Privacy, date strategy, project status
```

### Domain rule

**Medicine ≠ MedicineBatch (упаковка).**

- `Medicine` — логический препарат (`Нурофен 200 мг`)
- `MedicineBatch` — конкретная упаковка с `quantity` и `expiryDate`
- Несколько упаковок могут принадлежать одному лекарству

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

Inventory flows (stack):

- `/medicines/add`, `/medicines/[id]`, edit, packs
- `/cabinets`, `/cabinets/[cabinetId]/locations`

### Database migrations

- Migrations live in `src/db/migrations/`
- Version registry: `schema_migrations`
- Apply via `applyMigrations()` during bootstrap
- Never edit already-shipped migration SQL — append a new version

**Schema v1:** `households`, `people`, `medicine_cabinets`, `app_meta`, `schema_migrations`

**Schema v2:** `storage_locations`, `medicines`, `medicine_batches` (+ `archived_at` on cabinets)

## Git workflow

- GitHub `main` is the source of truth
- Prefer small focused commits
- Never commit secrets, keystores, `.env` with keys, or release binaries
- Push to `origin/main` after verified Phase checkpoints

## Roadmap

| Phase | Focus |
| --- | --- |
| Phase 0 | Foundation |
| Phase 1 | Аптечка / лекарства / партии (**current**) |
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
