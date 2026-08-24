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
  res.json(rows.map((c) => ({ id: c.id, name: c.name })));
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
  res.status(201).json({ id, name });
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
    books: books.map((b) => ({
      id: b.id,
      studentId: b.student_id,
      source: b.source,
      title: b.title,
      dateAdded: b.date_added,
    })),
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

router.delete("/students/:studentId", requireAuth, async (req, res) => {
  const student = await findStudentForTeacher(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  await query("DELETE FROM students WHERE id = $1", [student.id]);
  res.status(204).end();
});

router.post("/students/:studentId/books", requireAuth, async (req, res) => {
  const student = await findStudentForTeacher(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const { source, title } = req.body || {};
  if (source !== "WonderRoom" && source !== "Others") {
    return res.status(400).json({ error: "source must be WonderRoom or Others" });
  }
  const id = crypto.randomUUID();
  const row = await queryOne(
    "INSERT INTO book_entries (id, student_id, source, title) VALUES ($1, $2, $3, $4) RETURNING *",
    [id, student.id, source, (title || "").trim()],
  );
  res.status(201).json({
    id: row.id,
    studentId: row.student_id,
    source: row.source,
    title: row.title,
    dateAdded: row.date_added,
  });
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

// ---- Admin: oversight across every teacher's classes ----

router.get("/admin/classes", requireAuth, requireAdmin, async (req, res) => {
  const rows = await query(`
    SELECT classes.id, classes.name, classes.created_at, teachers.name AS teacher_name, teachers.email AS teacher_email,
      (SELECT COUNT(*) FROM students WHERE students.class_id = classes.id) AS student_count
    FROM classes JOIN teachers ON teachers.id = classes.teacher_id
    ORDER BY classes.created_at ASC
  `);
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      teacherName: c.teacher_name,
      teacherEmail: c.teacher_email,
      studentCount: Number(c.student_count),
      createdAt: c.created_at,
    })),
  );
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
    FROM classes JOIN teachers ON teachers.id = classes.teacher_id
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
