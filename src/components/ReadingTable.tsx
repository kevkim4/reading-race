import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "../types";
import type { StudentStats } from "../aggregate";

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
