import { Router } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
import { requireAuth, verifyGoogleCredential, upsertTeacherFromGoogle, issueSessionCookie, clearSessionCookie } from "./auth.js";
import { studentCompletionTime, GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "./completion.js";

export const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;

router.get("/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

// ---- Auth ----

router.post("/auth/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing credential" });
  try {
    const payload = await verifyGoogleCredential(credential);
    const teacher = upsertTeacherFromGoogle(payload);
    issueSessionCookie(res, teacher.id);
    res.json({ id: teacher.id, email: teacher.email, name: teacher.name });
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
  const teacher = upsertTeacherFromGoogle({ sub: `dev:${email}`, email, name });
  issueSessionCookie(res, teacher.id);
  res.json({ id: teacher.id, email: teacher.email, name: teacher.name });
});

router.post("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.teacher.id, email: req.teacher.email, name: req.teacher.name });
});

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
  const rows = allClassesWithTeacher.all().map((cls) => {
    const students = studentsForClass.all(cls.id);
    const completionTimes = students.map((s) => studentCompletionTime(booksForStudentAsc.all(s.id)));
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

  res.json({ goal: { totalBooks: GOAL_TOTAL_BOOKS, wonderRoomBooks: GOAL_WONDERROOM_BOOKS }, classes: rows });
});
