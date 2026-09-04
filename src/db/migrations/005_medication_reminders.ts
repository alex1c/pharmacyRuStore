/**
 * Migration 005 — native medication reminder ledger + reminder toggles.
 *
 * Does not cascade-delete intake history. Reminder cancellation is service-layer.
 */

export const migration005MedicationReminders = `
PRAGMA foreign_keys = ON;

ALTER TABLE medication_courses
	ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS scheduled_notifications (
	id TEXT PRIMARY KEY NOT NULL,
	occurrence_key TEXT NOT NULL UNIQUE,
	course_id TEXT NOT NULL,
	schedule_id TEXT NOT NULL,
	scheduled_date TEXT NOT NULL,
	scheduled_time TEXT NOT NULL,
	native_notification_id TEXT NOT NULL,
	trigger_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (course_id) REFERENCES medication_courses(id) ON DELETE RESTRICT,
	FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_course
	ON scheduled_notifications(course_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_trigger
	ON scheduled_notifications(trigger_at);

INSERT OR IGNORE INTO app_meta (key, value)
VALUES ('medication_reminders_enabled', '1');
`
