import { Router } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
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
    const teacher = upsertTeacherFromGoogle(payload);
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
router.post("/auth/dev-login", (req, res) => {
  if (GOOGLE_CLIENT_ID) {
    return res.status(403).json({ error: "Dev login is disabled once Google sign-in is configured" });
  }
  const name = (req.body?.name || "").trim();
  const email = (req.body?.email || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
  if (!isEmailAllowed(email)) {
    return res.status(403).json({ error: `Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in to Reading Race` });
  }
  const teacher = upsertTeacherFromGoogle({ sub: `dev:${email}`, email, name });
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

const findClassForTeacher = db.prepare("SELECT * FROM classes WHERE id = ? AND teacher_id = ?");
const findStudentForTeacher = db.prepare(`
  SELECT students.* FROM students
  JOIN classes ON classes.id = students.class_id
  WHERE students.id = ? AND classes.teacher_id = ?
`);
const findBookForTeacher = db.prepare(`
  SELECT book_entries.* FROM book_entries
  JOIN students ON students.id = book_entries.student_id
  JOIN classes ON classes.id = students.class_id
  WHERE book_entries.id = ? AND classes.teacher_id = ?
`);

function requireOwnedClass(req, res, classId) {
  const cls = findClassForTeacher.get(classId, req.teacher.id);
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return null;
  }
  return cls;
}

// ---- Classes ----

const listClasses = db.prepare("SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at ASC");
const insertClass = db.prepare("INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)");
const deleteClass = db.prepare("DELETE FROM classes WHERE id = ? AND teacher_id = ?");

router.get("/classes", requireAuth, (req, res) => {
  res.json(listClasses.all(req.teacher.id).map((c) => ({ id: c.id, name: c.name })));
});

router.post("/classes", requireAuth, (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Class name is required" });
  const id = crypto.randomUUID();
  insertClass.run(id, req.teacher.id, name);
  res.status(201).json({ id, name });
});

router.delete("/classes/:classId", requireAuth, (req, res) => {
  if (!requireOwnedClass(req, res, req.params.classId)) return;
  deleteClass.run(req.params.classId, req.teacher.id);
  res.status(204).end();
});

// ---- Students + books (scoped to one class) ----

const listStudents = db.prepare("SELECT * FROM students WHERE class_id = ? ORDER BY created_at ASC");
const insertStudent = db.prepare("INSERT INTO students (id, class_id, name) VALUES (?, ?, ?)");
const deleteStudent = db.prepare("DELETE FROM students WHERE id = ?");
const listBooksForClass = db.prepare(`
  SELECT book_entries.* FROM book_entries
  JOIN students ON students.id = book_entries.student_id
  WHERE students.class_id = ?
  ORDER BY date_added ASC
`);
const insertBook = db.prepare(
  "INSERT INTO book_entries (id, student_id, source, title) VALUES (?, ?, ?, ?)",
);
const deleteBook = db.prepare("DELETE FROM book_entries WHERE id = ?");

router.get("/classes/:classId/data", requireAuth, (req, res) => {
  if (!requireOwnedClass(req, res, req.params.classId)) return;
  const students = listStudents.all(req.params.classId);
  const books = listBooksForClass.all(req.params.classId);
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

router.post("/classes/:classId/students", requireAuth, (req, res) => {
  if (!requireOwnedClass(req, res, req.params.classId)) return;
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Student name is required" });
  const id = crypto.randomUUID();
  insertStudent.run(id, req.params.classId, name);
  res.status(201).json({ id, name });
});

router.delete("/students/:studentId", requireAuth, (req, res) => {
  const student = findStudentForTeacher.get(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  deleteStudent.run(student.id);
  res.status(204).end();
});

router.post("/students/:studentId/books", requireAuth, (req, res) => {
  const student = findStudentForTeacher.get(req.params.studentId, req.teacher.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const { source, title } = req.body || {};
  if (source !== "WonderRoom" && source !== "Others") {
    return res.status(400).json({ error: "source must be WonderRoom or Others" });
  }
  const id = crypto.randomUUID();
  insertBook.run(id, student.id, source, (title || "").trim());
  const row = db.prepare("SELECT * FROM book_entries WHERE id = ?").get(id);
  res.status(201).json({
    id: row.id,
    studentId: row.student_id,
    source: row.source,
    title: row.title,
    dateAdded: row.date_added,
  });
});

router.delete("/books/:bookId", requireAuth, (req, res) => {
  const book = findBookForTeacher.get(req.params.bookId, req.teacher.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  deleteBook.run(book.id);
  res.status(204).end();
});

// ---- Race window (admin-configured start/deadline dates) ----

const getRaceSettingsRow = db.prepare("SELECT start_date, deadline_date FROM race_settings WHERE id = 1");
const setRaceSettingsRow = db.prepare(
  "UPDATE race_settings SET start_date = ?, deadline_date = ? WHERE id = 1",
);

function getRaceWindow() {
  const row = getRaceSettingsRow.get();
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

router.get("/race-settings", requireAuth, (req, res) => {
  res.json(raceStatusFor(getRaceWindow()));
});

router.put("/race-settings", requireAuth, requireAdmin, (req, res) => {
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
  setRaceSettingsRow.run(start, deadline);
  res.json(raceStatusFor(getRaceWindow()));
});

// ---- Admin: oversight across every teacher's classes ----

const allClassesForAdmin = db.prepare(`
  SELECT classes.id, classes.name, classes.created_at, teachers.name AS teacher_name, teachers.email AS teacher_email,
    (SELECT COUNT(*) FROM students WHERE students.class_id = classes.id) AS student_count
  FROM classes JOIN teachers ON teachers.id = classes.teacher_id
  ORDER BY classes.created_at ASC
`);
const deleteAnyClass = db.prepare("DELETE FROM classes WHERE id = ?");

router.get("/admin/classes", requireAuth, requireAdmin, (req, res) => {
  res.json(
    allClassesForAdmin.all().map((c) => ({
      id: c.id,
      name: c.name,
      teacherName: c.teacher_name,
      teacherEmail: c.teacher_email,
      studentCount: c.student_count,
      createdAt: c.created_at,
    })),
  );
});

router.delete("/admin/classes/:classId", requireAuth, requireAdmin, (req, res) => {
  deleteAnyClass.run(req.params.classId);
  res.status(204).end();
});

// ---- Cross-class leaderboard (the "who finishes the race first" award) ----

const allClassesWithTeacher = db.prepare(`
  SELECT classes.id, classes.name, teachers.name AS teacher_name
  FROM classes JOIN teachers ON teachers.id = classes.teacher_id
  ORDER BY classes.created_at ASC
`);
const studentsForClass = db.prepare("SELECT id FROM students WHERE class_id = ?");
const booksForStudentAsc = db.prepare(
  "SELECT source, date_added FROM book_entries WHERE student_id = ? ORDER BY date_added ASC",
);

router.get("/leaderboard", requireAuth, (req, res) => {
  const window = getRaceWindow();
  const rows = allClassesWithTeacher.all().map((cls) => {
    const students = studentsForClass.all(cls.id);
    const completionTimes = students.map((s) =>
      studentCompletionTime(withinRaceWindow(booksForStudentAsc.all(s.id), window)),
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
  });

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
