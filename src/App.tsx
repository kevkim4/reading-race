import { useMemo } from "react";
import { StudentRoster } from "./components/StudentRoster";
import { AddBookForm } from "./components/AddBookForm";
import { ReadingChart } from "./components/ReadingChart";
import { ReadingTable } from "./components/ReadingTable";
import { useReadingRaceStore } from "./storage";
import { computeStudentStats } from "./aggregate";
import { GOAL_TOTAL_BOOKS, GOAL_WONDERROOM_BOOKS } from "./types";

function App() {
  const { students, books, addStudent, removeStudent, addBook } = useReadingRaceStore();
  const stats = useMemo(() => computeStudentStats(students, books), [students, books]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Reading Race</h1>
        <p className="subtitle">
          Each student reads {GOAL_TOTAL_BOOKS} books minimum — at least {GOAL_WONDERROOM_BOOKS}{" "}
          from WonderRoom (our school library), the rest from anywhere (EPIC, home, personal
          books, etc). Reading more WonderRoom books, or more books overall, is always welcome.
        </p>
      </header>

      <main>
        <div className="input-row">
          <StudentRoster students={students} onAdd={addStudent} onRemove={removeStudent} />
          <AddBookForm students={students} onAdd={addBook} />
        </div>

        <ReadingChart stats={stats} />
        <ReadingTable stats={stats} />
      </main>
    </div>
  );
}

export default App;
