import { classTotals, type StudentStats } from "../aggregate";
import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "../types";

interface Props {
  stats: StudentStats[];
  /** Student page wording ("our class") vs. teacher wording. */
  audience?: "teacher" | "student";
}

export function ClassTotal({ stats, audience = "teacher" }: Props) {
  if (stats.length === 0) return null;
  const { counted, possible, finished, readers } = classTotals(stats);
  const pct = possible > 0 ? Math.round((counted / possible) * 100) : 0;
  const anyBookSpots = GOAL_TOTAL_BOOKS - GOAL_WONDERROOM_BOOKS;

  return (
    <section className="panel class-total" aria-labelledby="class-total-heading">
      <h2 id="class-total-heading">{audience === "student" ? "Our class total" : "Class total"}</h2>
      <p className="class-total-figure">
        <span className="class-total-value">{counted}</span>
        <span className="class-total-of"> of {possible} books</span>
      </p>
      <div
        className="meter"
        role="meter"
        aria-label="Books counted toward the race"
        aria-valuemin={0}
        aria-valuemax={possible}
        aria-valuenow={counted}
      >
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="class-total-meta">
        <span>
          <strong>{finished}</strong> of {readers} {readers === 1 ? "reader" : "readers"} finished
        </span>
        <span>{pct}% of the way</span>
      </p>
      <p className="empty-hint class-total-rule">
        Each student counts up to {GOAL_TOTAL_BOOKS}: {anyBookSpots} books from anywhere plus{" "}
        {GOAL_WONDERROOM_BOOKS} from WonderRoom. Extra books past that don't add to the total.
      </p>
    </section>
  );
}
