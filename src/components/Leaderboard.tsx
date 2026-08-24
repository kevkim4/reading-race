import { useEffect, useState } from "react";
import { api, type LeaderboardClass } from "../api";

function formatFinishTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Leaderboard() {
  const [classes, setClasses] = useState<LeaderboardClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLeaderboard()
      .then((data) => setClasses(data.classes))
      .catch(() => setError("Could not load the race standings."));
  }, []);

  return (
    <section className="panel" aria-labelledby="leaderboard-heading">
      <h2 id="leaderboard-heading">Race standings</h2>
      <p className="empty-hint standings-hint">
        Every class racing to finish first — 10 books each, at least 2 from WonderRoom.
      </p>

      {error && <p className="error-text">{error}</p>}
      {!error && classes === null && <p className="empty-hint">Loading…</p>}
      {classes && classes.length === 0 && (
        <p className="empty-hint">No classes have joined the race yet.</p>
      )}

      {classes && classes.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Class</th>
                <th scope="col">Teacher</th>
                <th scope="col">Progress</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c, i) => (
                <tr key={c.classId}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">{c.className}</th>
                  <td>{c.teacherName}</td>
                  <td className="num">
                    {c.finishedCount} / {c.totalStudents}
                  </td>
                  <td>
                    {c.allFinished && c.classFinishTime ? (
                      <span className="badge badge-good">
                        {i === 0 ? "🏆 " : ""}
                        Finished {formatFinishTime(c.classFinishTime)}
                      </span>
                    ) : (
                      <span className="badge badge-pending">In progress</span>
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
