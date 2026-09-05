/**
 * Migration 007 — barcode identifiers + pack scan metadata.
 *
 * Codes live in a separate table so one Medicine can have multiple pack EANs/GTINs.
 * Lot/serial/raw stay on the batch for local package detail only.
 */

export const migration007Scanning = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS medicine_codes (
	id TEXT PRIMARY KEY NOT NULL,
	medicine_id TEXT NOT NULL,
	code_type TEXT NOT NULL,
	code_value TEXT NOT NULL,
	created_at TEXT NOT NULL,
	FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medicine_codes_value
	ON medicine_codes(code_value);

CREATE INDEX IF NOT EXISTS idx_medicine_codes_medicine
	ON medicine_codes(medicine_id);

ALTER TABLE medicine_batches ADD COLUMN lot_number TEXT;
ALTER TABLE medicine_batches ADD COLUMN serial_number TEXT;
ALTER TABLE medicine_batches ADD COLUMN scanned_code_raw TEXT;
`
