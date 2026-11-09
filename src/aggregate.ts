import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS, type BookEntry, type Student } from "./types";

export interface StudentStats {
  studentId: string;
  name: string;
  wonderRoom: number;
  others: number;
  total: number;
  metWonderRoomGoal: boolean;
  metTotalGoal: boolean;
  metAllGoals: boolean;
  /** Books that count toward the race: at most 10, of which at most 8 can be non-WonderRoom. */
  counted: number;
  /** Average AR level of this student's books that have one, rounded to 0.1; null if none. */
  arAverage: number | null;
  /** AR level of the most recently logged book that has one; null if none. */
  arLatest: number | null;
}

type BookForStats = Pick<BookEntry, "studentId" | "source"> & { arLevel?: number | null };

/**
 * A student's 10 race spots: 8 that any book can fill, plus 2 that only
 * WonderRoom books can fill. Extra WonderRoom books may also take the
 * "any book" spots. So 4 WR + 11 others = 10, 0 WR + 12 others = 8,
 * 1 WR + 12 others = 9. Reaching 10 is exactly the same as meeting the goal.
 */
export function countedBooks(wonderRoom: number, others: number): number {
  const anyBookSpots = GOAL_TOTAL_BOOKS - GOAL_WONDERROOM_BOOKS;
  return Math.min(GOAL_TOTAL_BOOKS, wonderRoom + Math.min(others, anyBookSpots));
}

export interface ClassTotals {
  counted: number;
  possible: number;
  finished: number;
  readers: number;
}

export function classTotals(stats: StudentStats[]): ClassTotals {
  return {
    counted: stats.reduce((sum, s) => sum + s.counted, 0),
    possible: stats.length * GOAL_TOTAL_BOOKS,
    finished: stats.filter((s) => s.metAllGoals).length,
    readers: stats.length,
  };
}

/** `books` must be oldest-first (both API endpoints return them that way) for `arLatest`. */
export function computeStudentStats(students: Student[], books: BookForStats[]): StudentStats[] {
  return students
    .map((student) => {
      const studentBooks = books.filter((b) => b.studentId === student.id);
      const levels = studentBooks
        .map((b) => b.arLevel)
        .filter((l): l is number => typeof l === "number");
      const arAverage =
        levels.length > 0 ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null;
      const arLatest = levels.length > 0 ? levels[levels.length - 1] : null;
      const wonderRoom = studentBooks.filter((b) => b.source === "WonderRoom").length;
      const others = studentBooks.filter((b) => b.source === "Others").length;
      const total = wonderRoom + others;
      const metWonderRoomGoal = wonderRoom >= GOAL_WONDERROOM_BOOKS;
      const metTotalGoal = total >= GOAL_TOTAL_BOOKS;
      return {
        studentId: student.id,
        name: student.name,
        wonderRoom,
        others,
        total,
        metWonderRoomGoal,
        metTotalGoal,
        metAllGoals: metWonderRoomGoal && metTotalGoal,
        counted: countedBooks(wonderRoom, others),
        arAverage,
        arLatest,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
