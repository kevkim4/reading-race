import { useState, type FormEvent } from "react";
import type { ApiBook } from "../api";
import type { BookSource, Student } from "../types";
import { StudentBookList } from "./StudentBookList";
import { lookUpArLevel, parseArInput } from "../arLookup";

interface Props {
  students: Student[];
  books: ApiBook[];
  onAdd: (studentId: string, source: BookSource, title: string, arLevel: number | null) => void;
  onUpdateBook: (bookId: string, source: BookSource, title: string, arLevel: number | null) => void;
  onRemoveBook: (bookId: string) => void;
}

export function AddBookForm({ students, books, onAdd, onUpdateBook, onRemoveBook }: Props) {
  const [studentId, setStudentId] = useState("");
  const [source, setSource] = useState<BookSource>("Others");
  const [title, setTitle] = useState("");
  const [arLevel, setArLevel] = useState("");
  const [lookupHint, setLookupHint] = useState<string | null>(null);

  const canSubmit = studentId !== "" && students.length > 0;
  const selectedStudent = students.find((s) => s.id === studentId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ar = parseArInput(arLevel);
    if (ar === undefined) return; // the number input's own validation explains why
    onAdd(studentId, source, title, ar);
    setTitle("");
    setArLevel("");
    setLookupHint(null);
  }

  async function handleLookUp() {
    const copied = await lookUpArLevel(title);
    setLookupHint(
      copied
        ? "Title copied. Paste it into AR BookFinder's search, then type the ATOS book level here."
        : "Search for the book on AR BookFinder, then type its ATOS book level here.",
    );
  }

  return (
    <section className="panel" aria-labelledby="log-heading">
      <h2 id="log-heading">Log a book</h2>
      {students.length === 0 ? (
        <p className="empty-hint">Add a student first to log a book for them.</p>
      ) : (
        <>
          <form className="log-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Student</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose a student…
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="source-toggle">
              <legend>Book source</legend>
              <div className="segmented" role="radiogroup" aria-label="Book source">
                <button
                  type="button"
                  className={source === "WonderRoom" ? "active" : ""}
                  aria-pressed={source === "WonderRoom"}
                  onClick={() => setSource("WonderRoom")}
                >
                  <span className="swatch swatch-wonderroom" aria-hidden="true" />
                  WonderRoom
                </button>
                <button
                  type="button"
                  className={source === "Others" ? "active" : ""}
                  aria-pressed={source === "Others"}
                  onClick={() => setSource("Others")}
                >
                  <span className="swatch swatch-others" aria-hidden="true" />
                  Others
                </button>
              </div>
            </fieldset>

            <div className="title-ar-row">
              <label className="field title-field">
                <span>Book title (optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Charlotte's Web"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="field ar-field">
                <span>AR level (optional)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="20"
                  placeholder="e.g. 4.4"
                  value={arLevel}
                  onChange={(e) => setArLevel(e.target.value)}
                />
              </label>
            </div>
            <div className="ar-lookup">
              <button type="button" className="link-button" onClick={handleLookUp}>
                Look up AR level ↗
              </button>
              {lookupHint && <span className="empty-hint ar-lookup-hint">{lookupHint}</span>}
            </div>

            <button type="submit" className="primary" disabled={!canSubmit}>
              Add book
            </button>
          </form>

          {selectedStudent && (
            <StudentBookList
              studentName={selectedStudent.name}
              books={books.filter((b) => b.studentId === selectedStudent.id)}
              onUpdate={onUpdateBook}
              onRemove={onRemoveBook}
            />
          )}
        </>
      )}
    </section>
  );
}
