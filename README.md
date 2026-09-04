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
  app/                 # Expo Router screens (tabs + inventory/intake flows)
  components/ui/       # Reusable UI primitives
  constants/           # Design tokens, forms, units, copy
  context/             # Database provider
  db/                  # SQLite, migrations, repositories
  domain/              # Schedule engine, FEFO, intake, inventory summaries
  hooks/               # Bootstrap / feature hooks
  services/            # Analytics, ads, medicine media
  utils/               # Dates, expiry, locale decimals, quantity, dose
docs/                  # Privacy, date strategy, project status
```

### Domain rule

**Medicine ≠ MedicineBatch (упаковка).**

- `Medicine` — логический препарат (`Нурофен 200 мг`)
- `MedicineBatch` — конкретная упаковка с `quantity` и `expiryDate`
- Несколько упаковок могут принадлежать одному лекарству

**MedicationCourse ≠ MedicationSchedule ≠ IntakeRecord.**

- Course — назначение лекарства человеку (доза, даты, PRN)
- Schedule — правило времени/дней (одна строка на одно время)
- IntakeRecord — факт taken / skipped / snoozed (+ actual time)
- Occurrences вычисляются движком, не materialize бесконечное будущее

### Startup flow

1. App launches
2. SQLite opens (`pharmacy.db`)
3. Migrations apply
4. First-run defaults seed (`Я`, `Дом`, household)
5. Tab UI becomes available
6. DB errors show a Russian fallback (no white screen)

### Navigation

1. Сегодня — приём сегодня + требует внимания
2. Аптечка
3. Приём — активные курсы + история
4. Покупки
5. Ещё

Inventory / intake flows (stack):

- `/medicines/add`, `/medicines/[id]`, edit, packs
- `/cabinets`, `/cabinets/[cabinetId]/locations`
- `/courses/form` (create/edit course)

### Database migrations

- Migrations live in `src/db/migrations/`
- Version registry: `schema_migrations`
- Apply via `applyMigrations()` during bootstrap
- Never edit already-shipped migration SQL — append a new version

**Schema v1:** `households`, `people`, `medicine_cabinets`, `app_meta`, `schema_migrations`

**Schema v2:** `storage_locations`, `medicines`, `medicine_batches` (+ `archived_at` on cabinets)

**Schema v3:** `medicines.low_stock_threshold`; settings keys `expiry_warning_days`, `default_low_stock_threshold`

**Schema v4:** `medication_courses`, `medication_schedules`, `intake_records`, `intake_inventory_movements`

### Monitoring (Phase 2)

- Effective expiry = earlier of package expiry and after-opening expiry
- `YYYY-MM` stays valid through the last local calendar day of that month
- Stock: empty (0), low (`quantity < threshold`), in stock (including equal threshold)
- Today «Требует внимания» with priority: expired → empty → expiring soon → low stock
- Settings: Ещё → Контроль запасов

### Schedules & intake (Phase 3)

- Types: daily, weekdays (bitmask), every N days (from course start), one-time, PRN
- Occurrence key: `scheduleId + date + HH:mm` with unique active index
- Taken → FEFO debit + movement ledger; skipped → no stock change; snooze → `snoozedUntil`
- Shortfall: warn, allow partial consume, `inventoryShortfall`, never negative qty
- Undo restores ledger quantities atomically
- Native notifications **not** included (Phase 4)
## Git workflow

- GitHub `main` is the source of truth
- Prefer small focused commits
- Never commit secrets, keystores, `.env` with keys, or release binaries
- Push to `origin/main` after verified Phase checkpoints

## Roadmap

| Phase | Focus |
| --- | --- |
| Phase 0 | Foundation |
| Phase 1 | Аптечка / лекарства / партии |
| Phase 2 | Сроки / остатки |
| Phase 3 | Курсы и приём (**current**) |
| Phase 4 | Native reminders |
| Phase 5 | Покупки и семья |
| Phase 6 | Scanning |
| Phase 7 | Backup / restore |
| Phase 8 | Ads + AppMetrica |
| Phase 9 | Release |

## Current status

See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).
