import { useState, type FormEvent } from "react";
import type { ApiBook } from "../api";
import type { BookSource, Student } from "../types";
import { StudentBookList } from "./StudentBookList";

interface Props {
  students: Student[];
  books: ApiBook[];
  onAdd: (studentId: string, source: BookSource, title: string) => void;
  onUpdateBook: (bookId: string, source: BookSource, title: string) => void;
  onRemoveBook: (bookId: string) => void;
}

export function AddBookForm({ students, books, onAdd, onUpdateBook, onRemoveBook }: Props) {
  const [studentId, setStudentId] = useState("");
  const [source, setSource] = useState<BookSource>("Others");
  const [title, setTitle] = useState("");

  const canSubmit = studentId !== "" && students.length > 0;
  const selectedStudent = students.find((s) => s.id === studentId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd(studentId, source, title);
    setTitle("");
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

            <label className="field">
              <span>Book title (optional)</span>
              <input
                type="text"
                placeholder="e.g. Charlotte's Web"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

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
