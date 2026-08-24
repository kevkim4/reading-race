import { useState, type FormEvent } from "react";
import type { ClassSummary } from "../api";

interface Props {
  classes: ClassSummary[];
  selectedClassId: string | null;
  onSelect: (classId: string) => void;
  onCreate: (name: string) => void;
}

export function ClassSwitcher({ classes, selectedClassId, onSelect, onCreate }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    setCreating(false);
  }

  return (
    <div className="class-switcher">
      {classes.length > 0 && (
        <select
          value={selectedClassId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Selected class"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {creating ? (
        <form className="class-create-form" onSubmit={handleCreate}>
          <input
            autoFocus
            placeholder="Class name (e.g. Room 12)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary">
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="link-button" onClick={() => setCreating(true)}>
          + New class
        </button>
      )}
    </div>
  );
}
