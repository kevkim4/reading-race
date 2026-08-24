import { useState, type FormEvent } from "react";
import type { Student } from "../types";

interface Props {
  students: Student[];
  onAdd: (name: string) => void;
  onRename: (studentId: string, name: string) => void;
  onRemove: (studentId: string) => void;
}

export function StudentRoster({ students, onAdd, onRename, onRemove }: Props) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name);
    setName("");
  }

  function startEditing(student: Student) {
    setEditingId(student.id);
    setEditingName(student.name);
  }

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingName.trim() || !editingId) return;
    onRename(editingId, editingName);
    setEditingId(null);
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
          {students.map((s) =>
            editingId === s.id ? (
              <li key={s.id}>
                <form className="roster-edit-form" onSubmit={handleRenameSubmit}>
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    aria-label={`Rename ${s.name}`}
                  />
                  <button type="submit" className="icon-button" aria-label="Save" title="Save">
                    ✓
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Cancel"
                    title="Cancel"
                    onClick={() => setEditingId(null)}
                  >
                    ×
                  </button>
                </form>
              </li>
            ) : (
              <li key={s.id}>
                <span>{s.name}</span>
                <span className="roster-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Rename ${s.name}`}
                    title={`Rename ${s.name}`}
                    onClick={() => startEditing(s)}
                  >
                    ✎
                  </button>
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
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
