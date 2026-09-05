# Backup format (Phase 7)

## Package

One ZIP file, e.g. `moya-aptechka-backup-2026-09-05-1905.zip`:

```text
manifest.json
data.json
media/
  medicine/
    <file-id>.jpg
```

## Versions

| Field | Meaning |
| --- | --- |
| `format` | Always `pharmacy-backup` |
| `formatVersion` | Logical backup format (**1**). Independent of SQLite schema version. |
| `schemaVersion` | Schema at create time (informational only — restore does not require equality). |

Future app versions migrate via `migrateBackupFormat()` when `formatVersion` increases.

Unsupported: `formatVersion` **greater** than the app supports → reject without mutation.

## Included data

Logical rows (including archived) for:

- households, people
- medicine_cabinets, storage_locations
- medicines, medicine_batches, medicine_codes
- medication_courses, medication_schedules
- intake_records, intake_inventory_movements
- shopping_items
- allowlisted settings: expiry warning days, default low-stock threshold, medication reminders enabled

## Excluded (derived / install-specific)

- `scheduled_notifications` (native IDs are meaningless after reinstall)
- caches, scanner session, logs, analytics/ad IDs
- migration markers / non-allowlisted `app_meta` keys

After restore: reminder sync rebuilds a fresh ledger if permission allows.

## Media

- Photos copied into `media/medicine/`
- `data.json` stores `media://medicine/<file>` refs (never old absolute device paths)
- Missing photos → backup warning; `photo_uri` null; backup still succeeds
- ZIP paths are validated against path traversal

## Restore policy

**Replace** current user data (no merge).

Flow:

1. Validate ZIP / manifest / data / media paths
2. In-memory safety snapshot of current DB
3. Transaction: clear user tables (FK-safe order) → insert backup rows
4. Write media files → map logical refs to new local URIs
5. On failure: re-apply safety snapshot (user data preserved)
6. After success: shopping reconciliation + reminder reconciliation

Concurrent backup/restore operations are locked (`BACKUP_BUSY`).

## Security / privacy

- Backup is **not encrypted** — store the file safely
- Created locally; the app does not upload it
- User chooses where to save/share via the system share sheet / document picker
- No `MANAGE_EXTERNAL_STORAGE`

## CSV export

Separate from backup. UTF-8 BOM, `;` separator, one row per **active** batch. Not a restore format.
