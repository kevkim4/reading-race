import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { RaceStatusProvider } from "./RaceStatusContext";
import { LoginScreen } from "./components/LoginScreen";
import { ClassSwitcher } from "./components/ClassSwitcher";
import { StudentRoster } from "./components/StudentRoster";
import { AddBookForm } from "./components/AddBookForm";
import { ReadingChart } from "./components/ReadingChart";
import { ReadingTable } from "./components/ReadingTable";
import { Leaderboard } from "./components/Leaderboard";
import { AdminPanel } from "./components/AdminPanel";
import { RaceStatusBanner } from "./components/RaceStatusBanner";
import { useClassData } from "./useClassData";
import { computeStudentStats } from "./aggregate";
import { api, type ClassSummary } from "./api";
import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "./types";

function App() {
  const { status, teacher, signOut } = useAuth();

  if (status === "loading") {
    return (
      <div className="app">
        <p className="empty-hint">Loading…</p>
      </div>
    );
  }

  if (status === "signed-out" || !teacher) {
    return <LoginScreen />;
  }

  return (
    <RaceStatusProvider>
      <SignedInApp teacherName={teacher.name} isAdmin={teacher.isAdmin} onSignOut={signOut} />
    </RaceStatusProvider>
  );
}

function SignedInApp({
  teacherName,
  isAdmin,
  onSignOut,
}: {
  teacherName: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [tab, setTab] = useState<"class" | "standings" | "admin">("class");

  const loadClasses = useCallback(async () => {
    const list = await api.getClasses();
    setClasses(list);
    return list;
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  async function handleCreateClass(name: string) {
    const created = await api.createClass(name);
    await loadClasses();
    setSelectedClassId(created.id);
  }

  const { students, books, addStudent, removeStudent, addBook } = useClassData(selectedClassId);
  const stats = useMemo(() => computeStudentStats(students, books), [students, books]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Reading Race</h1>
          <div className="account">
            <span>{teacherName}</span>
            <button type="button" className="link-button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
        <p className="subtitle">
          Each student reads {GOAL_TOTAL_BOOKS} books minimum — at least {GOAL_WONDERROOM_BOOKS}{" "}
          from WonderRoom (our school library), the rest from anywhere (EPIC, home, personal
          books, etc). Reading more WonderRoom books, or more books overall, is always welcome.
        </p>

        <RaceStatusBanner />

        <ClassSwitcher
          classes={classes}
          selectedClassId={selectedClassId}
          onSelect={setSelectedClassId}
          onCreate={handleCreateClass}
        />

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "class"}
            className={tab === "class" ? "active" : ""}
            onClick={() => setTab("class")}
          >
            My class
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "standings"}
            className={tab === "standings" ? "active" : ""}
            onClick={() => setTab("standings")}
          >
            Race standings
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "admin"}
              className={tab === "admin" ? "active" : ""}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          )}
        </div>
      </header>

      <main>
        {tab === "class" &&
          (classes.length === 0 ? (
            <p className="empty-hint">Create your first class above to get started.</p>
          ) : (
            <>
              <div className="input-row">
                <StudentRoster students={students} onAdd={addStudent} onRemove={removeStudent} />
                <AddBookForm students={students} onAdd={addBook} />
              </div>

              <ReadingChart stats={stats} />
              <ReadingTable stats={stats} />
            </>
          ))}

        {tab === "standings" && <Leaderboard />}
        {tab === "admin" && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}

export default App;
