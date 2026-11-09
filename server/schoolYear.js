import ExcelJS from "exceljs";
import { query, transaction } from "./db.js";
import { countedBooks, GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "./completion.js";

export const NEW_YEAR_CONFIRMATION = "NEW YEAR";

function styleSheet(sheet, widths) {
  sheet.columns.forEach((col, i) => {
    col.width = widths[i] ?? 14;
  });
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDEA" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

const oneDecimal = (n) => (n == null ? null : Math.round(n * 10) / 10);

/**
 * One workbook for the whole school, matching what teachers see on
 * "My class": every logged book, regardless of the race dates.
 */
export async function buildSchoolWorkbook() {
  const [classes, students, books, race] = await Promise.all([
    query(`
      SELECT classes.id, classes.name, teachers.name AS teacher_name, teachers.email AS teacher_email
      FROM classes LEFT JOIN teachers ON teachers.id = classes.teacher_id
      ORDER BY lower(classes.name), classes.created_at`),
    query("SELECT id, class_id, name FROM students ORDER BY lower(name), created_at"),
    query(`
      SELECT book_entries.student_id, book_entries.source, book_entries.title,
        book_entries.ar_level, book_entries.date_added
      FROM book_entries ORDER BY book_entries.date_added ASC`),
    query("SELECT start_date, deadline_date FROM race_settings WHERE id = 1"),
  ]);

  const booksByStudent = new Map();
  for (const b of books) {
    if (!booksByStudent.has(b.student_id)) booksByStudent.set(b.student_id, []);
    booksByStudent.get(b.student_id).push(b);
  }
  const studentsByClass = new Map();
  for (const s of students) {
    if (!studentsByClass.has(s.class_id)) studentsByClass.set(s.class_id, []);
    studentsByClass.get(s.class_id).push(s);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Reading Race";
  wb.created = new Date();

  const classSheet = wb.addWorksheet("Classes");
  classSheet.addRow(["Class", "Teacher", "Teacher email", "Students", "Books counted", "Possible", "Readers finished"]);
  const studentSheet = wb.addWorksheet("Students");
  studentSheet.addRow([
    "Class", "Teacher", "Student", "WonderRoom", "Others", "Total books",
    "Counts toward race", "Avg AR", "Latest AR", "Goal met",
  ]);
  const bookSheet = wb.addWorksheet("Books");
  bookSheet.addRow(["Class", "Teacher", "Student", "Title", "Source", "AR level", "Date logged"]);

  for (const cls of classes) {
    const teacher = cls.teacher_name ?? "Unassigned";
    const roster = studentsByClass.get(cls.id) ?? [];
    let classCounted = 0;
    let finished = 0;
    for (const s of roster) {
      const sb = booksByStudent.get(s.id) ?? [];
      const wonderRoom = sb.filter((b) => b.source === "WonderRoom").length;
      const others = sb.length - wonderRoom;
      const counted = countedBooks(wonderRoom, others);
      const levels = sb.filter((b) => b.ar_level != null).map((b) => Number(b.ar_level));
      const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null;
      const goalMet = wonderRoom >= GOAL_WONDERROOM_BOOKS && sb.length >= GOAL_TOTAL_BOOKS;
      classCounted += counted;
      if (goalMet) finished += 1;
      studentSheet.addRow([
        cls.name, teacher, s.name, wonderRoom, others, sb.length, counted,
        oneDecimal(avg), levels.length ? levels[levels.length - 1] : null, goalMet ? "Yes" : "No",
      ]);
      for (const b of sb) {
        bookSheet.addRow([
          cls.name, teacher, s.name, b.title || "", b.source,
          b.ar_level == null ? null : Number(b.ar_level), new Date(b.date_added),
        ]);
      }
    }
    classSheet.addRow([
      cls.name, teacher, cls.teacher_email ?? "", roster.length, classCounted,
      roster.length * GOAL_TOTAL_BOOKS, finished,
    ]);
  }

  styleSheet(classSheet, [24, 20, 28, 10, 14, 10, 16]);
  styleSheet(studentSheet, [24, 20, 22, 12, 10, 12, 18, 9, 10, 10]);
  styleSheet(bookSheet, [24, 20, 22, 32, 12, 10, 14]);
  studentSheet.getColumn(8).numFmt = "0.0";
  studentSheet.getColumn(9).numFmt = "0.0";
  bookSheet.getColumn(6).numFmt = "0.0";
  bookSheet.getColumn(7).numFmt = "yyyy-mm-dd";

  const info = wb.addWorksheet("About");
  info.addRow(["Reading Race export"]).font = { bold: true, size: 14 };
  info.addRow(["Exported on", new Date()]);
  info.addRow(["Race start date", race[0]?.start_date ?? "not set"]);
  info.addRow(["Race deadline", race[0]?.deadline_date ?? "not set"]);
  info.addRow([
    "Note",
    `Includes every logged book. "Counts toward race" = up to ${GOAL_TOTAL_BOOKS} per student: ` +
      `${GOAL_TOTAL_BOOKS - GOAL_WONDERROOM_BOOKS} from anywhere + ${GOAL_WONDERROOM_BOOKS} WonderRoom.`,
  ]);
  info.getCell("B2").numFmt = "yyyy-mm-dd hh:mm";
  info.getColumn(1).width = 18;
  info.getColumn(2).width = 80;

  return wb.xlsx.writeBuffer();
}

/**
 * Empties every class for a new school year, all-or-nothing. Keeps classes,
 * teachers and admin settings; deletes students (and, via the FK cascade,
 * their books); turns off student links; clears the race dates.
 */
export async function startNewSchoolYear() {
  return transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT (SELECT COUNT(*) FROM students) AS students, (SELECT COUNT(*) FROM book_entries) AS books",
    );
    await client.query("DELETE FROM students");
    await client.query("UPDATE classes SET share_token = NULL");
    await client.query("UPDATE race_settings SET start_date = NULL, deadline_date = NULL WHERE id = 1");
    return { deletedStudents: Number(rows[0].students), deletedBooks: Number(rows[0].books) };
  });
}
