import pg from "pg";

const { Pool } = pg;

// Return TIMESTAMPTZ columns as ISO-8601 strings (not JS Date objects) so
// the rest of the app can keep comparing/serializing dates as plain strings.
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set — set it to a Postgres connection string (see README / .env.example).",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS book_entries (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('WonderRoom', 'Others')),
      title TEXT NOT NULL DEFAULT '',
      date_added TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_books_student ON book_entries(student_id);

    -- Single-row table: the school-wide race window, set by an admin.
    CREATE TABLE IF NOT EXISTS race_settings (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      start_date TEXT,
      deadline_date TEXT
    );
    INSERT INTO race_settings (id, start_date, deadline_date)
    VALUES (1, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);
}
