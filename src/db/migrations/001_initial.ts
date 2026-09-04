/**
 * Migration 001 — initial Phase 0 schema.
 *
 * Entities:
 * - households: local data space
 * - people: family members (seed: «Я»)
 * - medicine_cabinets: home cabinets (seed: «Дом»)
 *
 * Medicine / batch tables are deferred to Phase 1, but FKs and household
 * scoping already anticipate multi-cabinet, multi-person data.
 */

export const migration001Initial = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
	version INTEGER PRIMARY KEY NOT NULL,
	applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
	key TEXT PRIMARY KEY NOT NULL,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS households (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
	id TEXT PRIMARY KEY NOT NULL,
	household_id TEXT NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_people_household
	ON people(household_id);

CREATE TABLE IF NOT EXISTS medicine_cabinets (
	id TEXT PRIMARY KEY NOT NULL,
	household_id TEXT NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medicine_cabinets_household
	ON medicine_cabinets(household_id);
`
