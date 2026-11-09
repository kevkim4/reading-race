import { Router } from "express";
import crypto from "node:crypto";
import { query, queryOne } from "./db.js";
import {
  requireAuth,
  verifyGoogleCredential,
  upsertTeacherFromGoogle,
  issueSessionCookie,
  clearSessionCookie,
  isEmailAllowed,
  isAdminEmail,
  teacherResponse,
} from "./auth.js";
import { studentCompletionTime, GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "./completion.js";

export const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "").trim() || null;

router.get("/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID, allowedEmailDomain: ALLOWED_EMAIL_DOMAIN });
});

// ---- Auth ----

router.post("/auth/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing credential" });
  try {
    const payload = await verifyGoogleCredential(credential);
    if (!payload.email_verified) {
      return res.status(403).json({ error: "Your Google account's email isn't verified" });
    }
    if (!isEmailAllowed(payload.email)) {
      return res.status(403).json({
        error: `Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in to Reading Race`,
      });
    }
    const teacher = await upsertTeacherFromGoogle(payload);
    issueSessionCookie(res, teacher.id);
    res.json(teacherResponse(teacher));
  } catch (err) {
    console.error("[auth/google]", err.message);
    res.status(401).json({ error: "Could not verify Google sign-in" });
  }
});

// Dev-only stand-in for Google sign-in, used while GOOGLE_CLIENT_ID isn't
// configured yet so the app can still be tried out end-to-end. Disabled the
// moment a real client ID is set.
router.post("/auth/dev-login", async (req, res) => {
  if (GOOGLE_CLIENT_ID) {
    return res.status(403).json({ error: "Dev login is disabled once Google sign-in is configured" });
  }
  const name = (req.body?.name || "").trim();
  const email = (req.body?.email || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
  if (!isEmailAllowed(email)) {
    return res.status(403).json({ error: `Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in to Reading Race` });
  }
  const teacher = await upsertTeacherFromGoogle({ sub: `dev:${email}`, email, name });
  issueSessionCookie(res, teacher.id);
  res.json(teacherResponse(teacher));
});

router.post("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json(teacherResponse(req.teacher));
});

function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.teacher.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ---- Ownership-checked lookups ----

function findClassForTeacher(classId, teacherId) {
  return queryOne("SELECT * FROM classes WHERE id = $1 AND teacher_id = $2", [classId, teacherId]);
}
function findStudentForTeacher(studentId, teacherId) {
  return queryOne(
    `SELECT students.* FROM students
     JOIN classes ON classes.id = students.class_id
     WHERE students.id = $1 AND classes.teacher_id = $2`,
    [studentId, teacherId],
  );
}
function findBookForTeacher(bookId, teacherId) {
  return queryOne(
    `SELECT book_entries.* FROM book_entries
     JOIN students ON students.id = book_entries.student_id
     JOIN classes ON classes.id = students.class_id
     WHERE book_entries.id = $1 AND classes.teacher_id = $2`,
    [bookId, teacherId],
  );
}

// pg returns NUMERIC columns as strings; the API speaks plain numbers (or null).
function bookResponse(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    source: row.source,
    title: row.title,
    dateAdded: row.date_added,
    arLevel: row.ar_level == null ? null : Number(row.ar_level),
  };
}

// AR (ATOS) book levels run from about 0.1 to the low teens. Accept 0–20,
// rounded to one decimal. undefined = not sent (leave as is), null/"" = clear.
function parseArLevel(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 20) return { ok: false };
  return { ok: true, value: Math.round(n * 10) / 10 };
}

async function requireOwnedClass(req, res, classId) {
  const cls = await findClassForTeacher(classId, req.teacher.id);
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return null;
  }
  return cls;
}

// ---- Classes ----

router.get("/classes", requireAuth, async (req, res) => {
  const rows = await query("SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at ASC", [
    req.teacher.id,
  ]);
  res.json(rows.map((c) => ({ id: c.id, name: c.name, shareToken: c.share_token })));
});

router.post("/classes", requireAuth, async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Class name is required" });
  const id = crypto.randomUUID();
  await query("INSERT INTO classes (id, teacher_id, name) VALUES ($1, $2, $3)", [
    id,
    req.teacher.id,
    name,
  ]);
  res.status(201).json({ id, name, shareToken: null });
});

// ---- Student view sharing (public read-only link per class) ----

// Turns sharing on, or replaces the existing link (old link stops working).
router.post("/classes/:classId/share", requireAuth, async (req, res) => {
  if (!(await requireOwnedClass(req, res, req.params.classId))) return;
  const token = crypto.randomBytes(18).toString("base64url");
  await query("UPDATE classes SET share_token = $1 WHERE id = $2", [token, req.params.classId]);
  res.json({ shareToken: token });
});

router.delete("/classes/:classId/share", requireAuth, async (req, res) => {
  if (!(await requireOwnedClass(req, res, req.params.classId))) return;
  await query("UPDATE classes SET share_token = NULL WHERE id = $1", [req.params.classId]);
  res.status(204).end();
});

// No sign-in: anyone with the link sees the class's names, book counts and
// AR levels. Book titles and dates are deliberately not included; books come
// back oldest-first (without dates) so the page can show each student's latest
// AR level.
router.get("/public/classes/:token", async (req, res) => {
  const cls = await queryOne("SELECT id, name FROM classes WHERE share_token = $1", [
    req.params.token,
  ]);
  if (!cls) return res.status(404).json({ error: "This link isn't active" });
  const students = await query("SELECT id, name FROM students WHERE class_id = $1", [cls.id]);
  const books = await query(
    `SELECT book_entries.student_id, book_entries.source, book_entries.ar_level FROM book_entries
     JOIN students ON students.id = book_entries.student_id
     WHERE students.class_id = $1
     ORDER BY book_entries.date_added ASC`,
    [cls.id],
  );
  res.json({
    className: cls.name,
    raceStatus: raceStatusFor(await getRaceWindow()),
    students: students.map((s) => ({ id: s.id, name: s.name })),
    books: books.map((b) => ({
      studentId: b.student_id,
      source: b.source,
      arLevel: b.ar_level == null ? null : Number(b.ar_level),
    })),
  });
});

router.delete("/classes/:classId", requireAuth, async (req, res) => {
  if (!(await requireOwnedClass(req, res, req.params.classId))) return;
  await query("DELETE FROM classes WHERE id = $1 AND teacher_id = $2", [
    req.params.classId,
    req.teacher.id,
  ]);
  res.status(204).end();
});

// ---- Students + books (scoped to one class) ----

router.get("/classes/:classId/data", requireAuth, async (req, res) => {
  if (!(await requireOwnedClass(req, res, req.params.classId))) return;
  const students = await query("SELECT * FROM students WHERE class_id = $1 ORDER BY created_at ASC", [
    req.params.classId,
  ]);
  const books = await query(
    `SELECT book_entries.* FROM book_entries
     JOIN students ON students.id = book_entries.student_id
     WHERE students.class_id = $1
     ORDER BY date_added ASC`,
    [req.params.classId],
  );
  res.json({
    students: students.map((s) => ({ id: s.id, name: s.name })),
    books: books.map(bookResponse),
  });
});

router.post("/classes/:classId/students", requireAuth, async (req, res) => {
  if (!(await requireOwnedClass(req, res, req.params.classId))) return;
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Student name is required" });
  const id = crypto.randomUUID();
  await query("INSERT INTO students (id, class_id, name) VALUES ($1, $2, $3)", [
    id,
    req.params.classId,
    name,
  ]);
  res.status(201).json({ id, name });
});

router.patch("/students/:studentId", requireAuth, async (req, res) => {
  const student = await findStudentForTeacher(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Student name is required" });
  const row = await queryOne("UPDATE students SET name = $1 WHERE id = $2 RETURNING *", [
    name,
    student.id,
  ]);
  res.json({ id: row.id, name: row.name });
});

router.delete("/students/:studentId", requireAuth, async (req, res) => {
  const student = await findStudentForTeacher(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  await query("DELETE FROM students WHERE id = $1", [student.id]);
  res.status(204).end();
});

router.post("/students/:studentId/books", requireAuth, async (req, res) => {
  const student = await findStudentForTeacher(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const { source, title, arLevel } = req.body || {};
  if (source !== "WonderRoom" && source !== "Others") {
    return res.status(400).json({ error: "source must be WonderRoom or Others" });
  }
  const ar = parseArLevel(arLevel);
  if (!ar.ok) return res.status(400).json({ error: "AR level must be a number from 0 to 20" });
  const id = crypto.randomUUID();
  const row = await queryOne(
    `INSERT INTO book_entries (id, student_id, source, title, ar_level)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, student.id, source, (title || "").trim(), ar.value ?? null],
  );
  res.status(201).json(bookResponse(row));
});

router.patch("/books/:bookId", requireAuth, async (req, res) => {
  const book = await findBookForTeacher(req.params.bookId, req.teacher.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  const { source, title, arLevel } = req.body || {};
  if (source !== "WonderRoom" && source !== "Others") {
    return res.status(400).json({ error: "source must be WonderRoom or Others" });
  }
  const ar = parseArLevel(arLevel);
  if (!ar.ok) return res.status(400).json({ error: "AR level must be a number from 0 to 20" });
  const row =
    ar.value === undefined
      ? await queryOne("UPDATE book_entries SET source = $1, title = $2 WHERE id = $3 RETURNING *", [
          source,
          (title || "").trim(),
          book.id,
        ])
      : await queryOne(
          "UPDATE book_entries SET source = $1, title = $2, ar_level = $3 WHERE id = $4 RETURNING *",
          [source, (title || "").trim(), ar.value, book.id],
        );
  res.json(bookResponse(row));
});

router.delete("/books/:bookId", requireAuth, async (req, res) => {
  const book = await findBookForTeacher(req.params.bookId, req.teacher.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  await query("DELETE FROM book_entries WHERE id = $1", [book.id]);
  res.status(204).end();
});

// ---- Race window (admin-configured start/deadline dates) ----

async function getRaceWindow() {
  const row = await queryOne("SELECT start_date, deadline_date FROM race_settings WHERE id = 1");
  return { startDate: row.start_date || null, deadlineDate: row.deadline_date || null };
}

function raceStatusFor(window) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const hasStarted = !window.startDate || today >= window.startDate;
  const isOver = !!window.deadlineDate && today > window.deadlineDate;
  return { ...window, hasStarted, isOver };
}

// Only book entries logged within [startDate, deadlineDate] count toward the
// race (a student's 10-book / 2-WonderRoom goal for leaderboard purposes).
function withinRaceWindow(books, window) {
  const start = window.startDate; // "YYYY-MM-DD" sorts correctly against ISO datetimes
  const end = window.deadlineDate ? `${window.deadlineDate}T23:59:59.999Z` : null;
  return books.filter((b) => (!start || b.date_added >= start) && (!end || b.date_added <= end));
}

router.get("/race-settings", requireAuth, async (req, res) => {
  res.json(raceStatusFor(await getRaceWindow()));
});

router.put("/race-settings", requireAuth, requireAdmin, async (req, res) => {
  const { startDate, deadlineDate } = req.body || {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const value of [startDate, deadlineDate]) {
    if (value != null && value !== "" && !datePattern.test(value)) {
      return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    }
  }
  const start = startDate || null;
  const deadline = deadlineDate || null;
  if (start && deadline && start > deadline) {
    return res.status(400).json({ error: "Start date must be before the deadline" });
  }
  await query("UPDATE race_settings SET start_date = $1, deadline_date = $2 WHERE id = 1", [
    start,
    deadline,
  ]);
  res.json(raceStatusFor(await getRaceWindow()));
});

// ---- Admin: teachers and classes across the school ----

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function teacherExists(id) {
  return Boolean(await queryOne("SELECT 1 FROM teachers WHERE id = $1", [id]));
}

// Validates an optional teacherId from a request body. undefined = not sent.
async function parseTeacherId(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !(await teacherExists(value))) return { ok: false };
  return { ok: true, value };
}

router.get("/admin/teachers", requireAuth, requireAdmin, async (req, res) => {
  const rows = await query(`
    SELECT teachers.id, teachers.name, teachers.email, teachers.google_sub IS NOT NULL AS signed_in,
      (SELECT COUNT(*) FROM classes WHERE classes.teacher_id = teachers.id) AS class_count
    FROM teachers
    ORDER BY lower(teachers.name) ASC
  `);
  res.json(
    rows.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      signedIn: t.signed_in,
      isAdmin: isAdminEmail(t.email),
      isYou: t.id === req.teacher.id,
      classCount: Number(t.class_count),
    })),
  );
});

// Adds a teacher who hasn't signed in yet; their first Google sign-in with
// this email claims the entry (and any classes assigned to it).
router.post("/admin/teachers", requireAuth, requireAdmin, async (req, res) => {
  const name = (req.body?.name || "").trim();
  const email = (req.body?.email || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "Teacher name is required" });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (!isEmailAllowed(email)) {
    return res.status(400).json({ error: `Teachers need an @${ALLOWED_EMAIL_DOMAIN} email to sign in` });
  }
  const existing = await queryOne("SELECT name FROM teachers WHERE lower(email) = $1", [email]);
  if (existing) {
    return res.status(409).json({ error: `${existing.name} already uses ${email}` });
  }
  const id = crypto.randomUUID();
  await query("INSERT INTO teachers (id, google_sub, email, name) VALUES ($1, NULL, $2, $3)", [
    id,
    email,
    name,
  ]);
  res.status(201).json({ id, name, email, signedIn: false, isAdmin: isAdminEmail(email), isYou: false, classCount: 0 });
});

router.patch("/admin/teachers/:teacherId", requireAuth, requireAdmin, async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Teacher name is required" });
  const row = await queryOne("UPDATE teachers SET name = $1 WHERE id = $2 RETURNING id, name", [
    name,
    req.params.teacherId,
  ]);
  if (!row) return res.status(404).json({ error: "Teacher not found" });
  res.json(row);
});

// Their classes are kept and become unassigned (see the classes.teacher_id FK).
router.delete("/admin/teachers/:teacherId", requireAuth, requireAdmin, async (req, res) => {
  if (req.params.teacherId === req.teacher.id) {
    return res.status(400).json({ error: "You can't remove yourself" });
  }
  await query("DELETE FROM teachers WHERE id = $1", [req.params.teacherId]);
  res.status(204).end();
});

router.get("/admin/classes", requireAuth, requireAdmin, async (req, res) => {
  const rows = await query(`
    SELECT classes.id, classes.name, classes.created_at, classes.teacher_id,
      teachers.name AS teacher_name, teachers.email AS teacher_email,
      (SELECT COUNT(*) FROM students WHERE students.class_id = classes.id) AS student_count
    FROM classes LEFT JOIN teachers ON teachers.id = classes.teacher_id
    ORDER BY lower(classes.name) ASC, classes.created_at ASC
  `);
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      teacherName: c.teacher_name,
      teacherEmail: c.teacher_email,
      studentCount: Number(c.student_count),
      createdAt: c.created_at,
    })),
  );
});

router.post("/admin/classes", requireAuth, requireAdmin, async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Class name is required" });
  const teacher = await parseTeacherId(req.body?.teacherId);
  if (!teacher.ok) return res.status(400).json({ error: "That teacher no longer exists" });
  const id = crypto.randomUUID();
  await query("INSERT INTO classes (id, teacher_id, name) VALUES ($1, $2, $3)", [
    id,
    teacher.value ?? null,
    name,
  ]);
  res.status(201).json({ id, name, teacherId: teacher.value ?? null });
});

// Rename and/or (re)assign a class. teacherId: null unassigns it.
router.patch("/admin/classes/:classId", requireAuth, requireAdmin, async (req, res) => {
  const cls = await queryOne("SELECT id, name, teacher_id FROM classes WHERE id = $1", [req.params.classId]);
  if (!cls) return res.status(404).json({ error: "Class not found" });
  const name = req.body?.name === undefined ? cls.name : String(req.body.name).trim();
  if (!name) return res.status(400).json({ error: "Class name is required" });
  const teacher = await parseTeacherId(req.body?.teacherId);
  if (!teacher.ok) return res.status(400).json({ error: "That teacher no longer exists" });
  const teacherId = teacher.value === undefined ? cls.teacher_id : teacher.value;
  await query("UPDATE classes SET name = $1, teacher_id = $2 WHERE id = $3", [name, teacherId, cls.id]);
  res.json({ id: cls.id, name, teacherId });
});

router.delete("/admin/classes/:classId", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM classes WHERE id = $1", [req.params.classId]);
  res.status(204).end();
});

// ---- Cross-class leaderboard (the "who finishes the race first" award) ----

router.get("/leaderboard", requireAuth, async (req, res) => {
  const window = await getRaceWindow();
  const classes = await query(`
    SELECT classes.id, classes.name, teachers.name AS teacher_name
    FROM classes LEFT JOIN teachers ON teachers.id = classes.teacher_id
    ORDER BY classes.created_at ASC
  `);

  const rows = await Promise.all(
    classes.map(async (cls) => {
      const students = await query("SELECT id FROM students WHERE class_id = $1", [cls.id]);
      const completionTimes = await Promise.all(
        students.map(async (s) => {
          const books = await query(
            "SELECT source, date_added FROM book_entries WHERE student_id = $1 ORDER BY date_added ASC",
            [s.id],
          );
          return studentCompletionTime(withinRaceWindow(books, window));
        }),
      );
      const finishedCount = completionTimes.filter(Boolean).length;
      const totalStudents = students.length;
      const allFinished = totalStudents > 0 && finishedCount === totalStudents;
      const classFinishTime = allFinished ? completionTimes.reduce((a, b) => (a > b ? a : b)) : null;
      return {
        classId: cls.id,
        className: cls.name,
        teacherName: cls.teacher_name,
        totalStudents,
        finishedCount,
        allFinished,
        classFinishTime,
      };
    }),
  );

  rows.sort((a, b) => {
    if (a.allFinished && b.allFinished) return a.classFinishTime < b.classFinishTime ? -1 : 1;
    if (a.allFinished) return -1;
    if (b.allFinished) return 1;
    const aProgress = a.totalStudents ? a.finishedCount / a.totalStudents : 0;
    const bProgress = b.totalStudents ? b.finishedCount / b.totalStudents : 0;
    return bProgress - aProgress;
  });

  res.json({
    goal: { totalBooks: GOAL_TOTAL_BOOKS, wonderRoomBooks: GOAL_WONDERROOM_BOOKS },
    raceStatus: raceStatusFor(window),
    classes: rows,
  });
});
