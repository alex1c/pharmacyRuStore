/**
 * Migration 002 — inventory domain: locations, medicines, batches.
 *
 * Critical rule: medicine ≠ batch.
 * Quantity and expiry live on medicine_batches only.
 */

export const migration002Inventory = `
PRAGMA foreign_keys = ON;

ALTER TABLE medicine_cabinets ADD COLUMN archived_at TEXT;

CREATE TABLE IF NOT EXISTS storage_locations (
	id TEXT PRIMARY KEY NOT NULL,
	cabinet_id TEXT NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (cabinet_id) REFERENCES medicine_cabinets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_storage_locations_cabinet
	ON storage_locations(cabinet_id);

CREATE INDEX IF NOT EXISTS idx_storage_locations_active
	ON storage_locations(cabinet_id, archived_at);

CREATE TABLE IF NOT EXISTS medicines (
	id TEXT PRIMARY KEY NOT NULL,
	household_id TEXT NOT NULL,
	name TEXT NOT NULL,
	form TEXT NOT NULL DEFAULT 'other',
	strength_text TEXT,
	notes TEXT,
	photo_uri TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_medicines_household
	ON medicines(household_id);

CREATE INDEX IF NOT EXISTS idx_medicines_active_name
	ON medicines(household_id, archived_at, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS medicine_batches (
	id TEXT PRIMARY KEY NOT NULL,
	medicine_id TEXT NOT NULL,
	cabinet_id TEXT NOT NULL,
	storage_location_id TEXT,
	quantity REAL NOT NULL,
	unit TEXT NOT NULL,
	expiry_date TEXT,
	opened_at TEXT,
	after_opening_value REAL,
	after_opening_unit TEXT,
	purchase_date TEXT,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
	FOREIGN KEY (cabinet_id) REFERENCES medicine_cabinets(id) ON DELETE RESTRICT,
	FOREIGN KEY (storage_location_id) REFERENCES storage_locations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_medicine
	ON medicine_batches(medicine_id);

CREATE INDEX IF NOT EXISTS idx_batches_cabinet
	ON medicine_batches(cabinet_id);

CREATE INDEX IF NOT EXISTS idx_batches_active_medicine
	ON medicine_batches(medicine_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_batches_expiry
	ON medicine_batches(expiry_date);
`
