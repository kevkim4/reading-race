export const GOAL_TOTAL_BOOKS = 10;
export const GOAL_WONDERROOM_BOOKS = 2;

// Same rule as countedBooks() in src/aggregate.ts (keep the two in sync):
// 8 spots any book can fill + 2 only WonderRoom books can fill.
export function countedBooks(wonderRoom, others) {
  const anyBookSpots = GOAL_TOTAL_BOOKS - GOAL_WONDERROOM_BOOKS;
  return Math.min(GOAL_TOTAL_BOOKS, wonderRoom + Math.min(others, anyBookSpots));
}

/**
 * booksAscByDate: this student's book_entries sorted oldest -> newest.
 * Returns the ISO timestamp of the book that first satisfied both the
 * 10-book and 2-WonderRoom minimums, or null if not yet complete.
 */
export function studentCompletionTime(booksAscByDate) {
  let wonderRoom = 0;
  let total = 0;
  for (const book of booksAscByDate) {
    total += 1;
    if (book.source === "WonderRoom") wonderRoom += 1;
    if (total >= GOAL_TOTAL_BOOKS && wonderRoom >= GOAL_WONDERROOM_BOOKS) {
      return book.date_added;
    }
  }
  return null;
}
