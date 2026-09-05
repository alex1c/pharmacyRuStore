/**
 * Migration 006 — family notes/archive + shopping list.
 *
 * History preserved: no CASCADE that would wipe courses/intakes/movements.
 */

export const migration006FamilyShopping = `
PRAGMA foreign_keys = ON;

ALTER TABLE people ADD COLUMN note TEXT;
ALTER TABLE people ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_people_household_active
	ON people(household_id, archived_at);

CREATE TABLE IF NOT EXISTS shopping_items (
	id TEXT PRIMARY KEY NOT NULL,
	household_id TEXT NOT NULL,
	medicine_id TEXT,
	custom_name TEXT,
	desired_quantity REAL,
	unit TEXT,
	reason TEXT NOT NULL,
	source TEXT NOT NULL,
	status TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	completed_at TEXT,
	archived_at TEXT,
	FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT,
	FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_shopping_household_status
	ON shopping_items(household_id, status, archived_at);

CREATE INDEX IF NOT EXISTS idx_shopping_medicine_status
	ON shopping_items(medicine_id, status);

CREATE INDEX IF NOT EXISTS idx_shopping_source_status
	ON shopping_items(source, status);

CREATE INDEX IF NOT EXISTS idx_shopping_completed
	ON shopping_items(completed_at);

-- At most one active automatic shopping row per medicine.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_auto_medicine_active
	ON shopping_items(medicine_id)
	WHERE source = 'automatic'
		AND status = 'active'
		AND medicine_id IS NOT NULL
		AND archived_at IS NULL;
`
