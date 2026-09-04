/**
 * Migration 004 — medication courses, schedules, intake history, inventory ledger.
 *
 * History is preserved: no CASCADE deletes that would wipe medical records.
 */

export const migration004MedicationSchedules = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS medication_courses (
	id TEXT PRIMARY KEY NOT NULL,
	household_id TEXT NOT NULL,
	person_id TEXT NOT NULL,
	medicine_id TEXT NOT NULL,
	dose_quantity REAL NOT NULL,
	dose_unit TEXT NOT NULL,
	start_date TEXT NOT NULL,
	end_date TEXT,
	instructions TEXT,
	is_prn INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT,
	FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT,
	FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_courses_household_active
	ON medication_courses(household_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_courses_medicine
	ON medication_courses(medicine_id);

CREATE INDEX IF NOT EXISTS idx_courses_person
	ON medication_courses(person_id);

CREATE TABLE IF NOT EXISTS medication_schedules (
	id TEXT PRIMARY KEY NOT NULL,
	course_id TEXT NOT NULL,
	type TEXT NOT NULL,
	time_of_day TEXT,
	weekdays_mask INTEGER,
	interval_days INTEGER,
	one_time_date TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (course_id) REFERENCES medication_courses(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_schedules_course
	ON medication_schedules(course_id, archived_at);

CREATE TABLE IF NOT EXISTS intake_records (
	id TEXT PRIMARY KEY NOT NULL,
	course_id TEXT NOT NULL,
	schedule_id TEXT,
	medicine_id TEXT NOT NULL,
	person_id TEXT NOT NULL,
	scheduled_date TEXT,
	scheduled_time TEXT,
	status TEXT NOT NULL,
	actual_taken_at TEXT,
	skipped_at TEXT,
	snoozed_until TEXT,
	dose_quantity REAL NOT NULL,
	dose_unit TEXT NOT NULL,
	note TEXT,
	inventory_shortfall INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	cancelled_at TEXT,
	FOREIGN KEY (course_id) REFERENCES medication_courses(id) ON DELETE RESTRICT,
	FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE RESTRICT,
	FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
	FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_intake_course_date
	ON intake_records(course_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_intake_history
	ON intake_records(person_id, created_at);

CREATE INDEX IF NOT EXISTS idx_intake_status_active
	ON intake_records(status, cancelled_at);

-- One active scheduled action per occurrence identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_occurrence_unique
	ON intake_records(schedule_id, scheduled_date, scheduled_time)
	WHERE schedule_id IS NOT NULL
		AND cancelled_at IS NULL
		AND status IN ('taken', 'skipped', 'snoozed');

CREATE TABLE IF NOT EXISTS intake_inventory_movements (
	id TEXT PRIMARY KEY NOT NULL,
	intake_record_id TEXT NOT NULL,
	batch_id TEXT NOT NULL,
	quantity REAL NOT NULL,
	created_at TEXT NOT NULL,
	FOREIGN KEY (intake_record_id) REFERENCES intake_records(id) ON DELETE RESTRICT,
	FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_movements_intake
	ON intake_inventory_movements(intake_record_id);

CREATE INDEX IF NOT EXISTS idx_movements_batch
	ON intake_inventory_movements(batch_id);
`
