import { GOAL_TOTAL_BOOKS } from "../types";
import type { StudentStats } from "../aggregate";

interface Props {
  stats: StudentStats[];
}

function niceMax(maxTotal: number): number {
  const floor = GOAL_TOTAL_BOOKS;
  if (maxTotal <= floor) return floor;
  return Math.ceil(maxTotal / 5) * 5;
}

export function ReadingChart({ stats }: Props) {
  const maxTotal = stats.reduce((m, s) => Math.max(m, s.total), 0);
  const xMax = niceMax(maxTotal);
  const goalPct = (GOAL_TOTAL_BOOKS / xMax) * 100;

  return (
    <section className="panel" aria-labelledby="chart-heading">
      <div className="chart-header">
        <h2 id="chart-heading">Reading progress</h2>
        <ul className="legend" aria-hidden="false">
          <li>
            <span className="swatch swatch-wonderroom" /> WonderRoom
          </li>
          <li>
            <span className="swatch swatch-others" /> Others
          </li>
        </ul>
      </div>

      {stats.length === 0 ? (
        <p className="empty-hint">Add students and log books to see the chart.</p>
      ) : (
        <div className="chart">
          <div className="chart-plot" style={{ ["--goal-pct" as string]: `${goalPct}%` }}>
            <div className="goal-line" style={{ left: `${goalPct}%` }}>
              <span className="goal-label">Goal: {GOAL_TOTAL_BOOKS} books</span>
            </div>
            {stats.map((s) => {
              const totalPct = (s.total / xMax) * 100;
              const wonderRoomOfBarPct = s.total > 0 ? (s.wonderRoom / s.total) * 100 : 0;
              const othersOfBarPct = s.total > 0 ? (s.others / s.total) * 100 : 0;
              const hasOthers = s.others > 0;
              const hasWonderRoom = s.wonderRoom > 0;
              return (
                <div className="chart-row" key={s.studentId}>
                  <div className="chart-row-label" title={s.name}>
                    {s.name}
                  </div>
                  <div className="chart-row-track">
                    <div className="chart-bar" style={{ width: `${totalPct}%` }}>
                      {hasWonderRoom && (
                        <div
                          className={`segment swatch-wonderroom${hasOthers ? " has-next" : " tip"}`}
                          style={{ width: `${wonderRoomOfBarPct}%` }}
                        />
                      )}
                      {hasOthers && (
                        <div
                          className="segment swatch-others tip"
                          style={{ width: `${othersOfBarPct}%` }}
                        />
                      )}
                    </div>
                    <span className="chart-row-value">
                      {s.total}
                      {s.metAllGoals && (
                        <span className="goal-met-badge" title="Goal met: 10+ books, 2+ WonderRoom">
                          ✓
                        </span>
                      )}
                    </span>
                    <div className="chart-tooltip" role="tooltip">
                      <strong>{s.name}</strong>
                      <div>WonderRoom: {s.wonderRoom}</div>
                      <div>Others: {s.others}</div>
                      <div>Total: {s.total}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
