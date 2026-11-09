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

// Runs fn(client) inside BEGIN/COMMIT on one connection; any error rolls
// everything back, so multi-step changes are all-or-nothing.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE, -- NULL until an admin-added teacher first signs in
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL, -- NULL = unassigned
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

    -- Unguessable token for the class's public, read-only student view.
    -- NULL means sharing is off.
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

    -- Admins can add teachers before they ever sign in, and classes can be
    -- unassigned. Older databases were created with stricter rules: relax them.
    ALTER TABLE teachers ALTER COLUMN google_sub DROP NOT NULL;
    ALTER TABLE classes ALTER COLUMN teacher_id DROP NOT NULL;
    -- Removing a teacher used to delete their classes (and every student and
    -- book in them). Now their classes just become unassigned.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'classes_teacher_id_fkey' AND confdeltype = 'c'
      ) THEN
        ALTER TABLE classes DROP CONSTRAINT classes_teacher_id_fkey;
        ALTER TABLE classes ADD CONSTRAINT classes_teacher_id_fkey
          FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
      END IF;
    END $$;

    -- Optional AR (ATOS) book level per logged book, e.g. 3.4. NULL = not entered.
    ALTER TABLE book_entries ADD COLUMN IF NOT EXISTS ar_level NUMERIC(4, 1)
      CHECK (ar_level >= 0 AND ar_level <= 20);

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
