export const GOAL_TOTAL_BOOKS = 10;
export const GOAL_WONDERROOM_BOOKS = 2;

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
