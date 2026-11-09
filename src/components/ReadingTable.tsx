import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "../types";
import type { StudentStats } from "../aggregate";

function formatAr(level: number | null): string {
  return level == null ? "—" : level.toFixed(1);
}

interface Props {
  stats: StudentStats[];
}

export function ReadingTable({ stats }: Props) {
  return (
    <section className="panel" aria-labelledby="table-heading">
      <h2 id="table-heading">Progress table</h2>
      {stats.length === 0 ? (
        <p className="empty-hint">Add students and log books to see the table.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">WonderRoom</th>
                <th scope="col">Others</th>
                <th scope="col">Total</th>
                <th scope="col" title="Books that count toward the class total (max 10)">
                  Counts
                </th>
                <th scope="col" title="Average AR level of books that have one">
                  Avg AR
                </th>
                <th scope="col" title="AR level of the most recently logged book that has one">
                  Latest AR
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.studentId}>
                  <th scope="row">{s.name}</th>
                  <td className="num">
                    <span className="num-inner">
                      {s.wonderRoom}
                      <span className={`status-dot ${s.metWonderRoomGoal ? "good" : "pending"}`} />
                    </span>
                  </td>
                  <td className="num">{s.others}</td>
                  <td className="num">{s.total}</td>
                  <td className="num counts-cell">{s.counted}</td>
                  <td className="num">{formatAr(s.arAverage)}</td>
                  <td className="num">{formatAr(s.arLatest)}</td>
                  <td>
                    {s.metAllGoals ? (
                      <span className="badge badge-good">✓ Goal met</span>
                    ) : (
                      <span className="badge badge-pending">
                        {GOAL_WONDERROOM_BOOKS - s.wonderRoom > 0
                          ? `${GOAL_WONDERROOM_BOOKS - s.wonderRoom} more WonderRoom`
                          : `${GOAL_TOTAL_BOOKS - s.total} more book${GOAL_TOTAL_BOOKS - s.total === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
