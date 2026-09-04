/**
 * Migration 003 — stock/expiry monitoring settings and per-medicine threshold.
 */

export const migration003Monitoring = `
PRAGMA foreign_keys = ON;

ALTER TABLE medicines ADD COLUMN low_stock_threshold REAL;

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('expiry_warning_days', '30');
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('default_low_stock_threshold', '5');
`
