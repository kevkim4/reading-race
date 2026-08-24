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
}

export function computeStudentStats(
  students: Student[],
  books: BookEntry[],
): StudentStats[] {
  return students
    .map((student) => {
      const studentBooks = books.filter((b) => b.studentId === student.id);
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
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
