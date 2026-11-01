import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type PublicClassView } from "../api";
import { computeStudentStats } from "../aggregate";
import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "../types";
import { RaceBanner } from "./RaceStatusBanner";
import { ReadingChart } from "./ReadingChart";
import { ReadingTable } from "./ReadingTable";

const REFRESH_MS = 60_000;

// Public, read-only page students open from a link (e.g. in Google Classroom).
export function ClassViewer({ token }: { token: string }) {
  const [data, setData] = useState<PublicClassView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "not-found" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const view = await api.getPublicClass(token);
      setData(view);
      setState("ok");
      setUpdatedAt(new Date());
      document.title = `${view.className} · Reading Race`;
    } catch (err) {
      // Keep showing the last good data if a background refresh fails.
      setState((prev) =>
        prev === "ok" ? prev : err instanceof Error && /isn't active/.test(err.message) ? "not-found" : "error",
      );
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const stats = useMemo(
    () => (data ? computeStudentStats(data.students, data.books) : []),
    [data],
  );
  const finished = stats.filter((s) => s.metAllGoals).length;

  if (state === "loading") {
    return (
      <div className="app">
        <p className="empty-hint">Loading…</p>
      </div>
    );
  }

  if (state !== "ok" || !data) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Reading Race</h1>
          <p className="subtitle">
            {state === "not-found"
              ? "This link isn't active anymore. Ask your teacher for the new one."
              : "Couldn't load the reading race right now. Try again in a minute."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app viewer">
      <header className="app-header">
        <p className="viewer-eyebrow">Reading Race</p>
        <h1>{data.className}</h1>
        <p className="subtitle">
          Read {GOAL_TOTAL_BOOKS} books, with at least {GOAL_WONDERROOM_BOOKS} from WonderRoom. When
          everyone in our class gets there, we finish the race!
        </p>
        <RaceBanner status={data.raceStatus} />
        {stats.length > 0 && (
          <p className="viewer-summary">
            <strong>
              {finished} of {stats.length}
            </strong>{" "}
            {stats.length === 1 ? "reader has" : "readers have"} reached the goal
          </p>
        )}
      </header>

      <main>
        <ReadingChart stats={stats} />
        <ReadingTable stats={stats} />
        {updatedAt && (
          <p className="empty-hint viewer-updated">
            Updates automatically · last updated{" "}
            {updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </main>
    </div>
  );
}
