import { useState, type FormEvent } from "react";
import type { Student } from "../types";

interface Props {
  students: Student[];
  onAdd: (name: string) => void;
  onRemove: (studentId: string) => void;
}

export function StudentRoster({ students, onAdd, onRemove }: Props) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name);
    setName("");
  }

  return (
    <section className="panel" aria-labelledby="roster-heading">
      <h2 id="roster-heading">Students</h2>
      <form className="roster-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add a student's name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Student name"
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {students.length === 0 ? (
        <p className="empty-hint">No students yet — add your first one above.</p>
      ) : (
        <ul className="roster-list">
          {students.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${s.name}`}
                title={`Remove ${s.name}`}
                onClick={() => {
                  if (confirm(`Remove ${s.name} and all their reading records?`)) {
                    onRemove(s.id);
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
