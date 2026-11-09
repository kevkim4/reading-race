import { useState, type FormEvent } from "react";
import type { ApiBook } from "../api";
import type { BookSource } from "../types";
import { lookUpArLevel, parseArInput } from "../arLookup";

interface Props {
  studentName: string;
  books: ApiBook[];
  onUpdate: (bookId: string, source: BookSource, title: string, arLevel: number | null) => void;
  onRemove: (bookId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StudentBookList({ studentName, books, onUpdate, onRemove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<BookSource>("Others");
  const [editTitle, setEditTitle] = useState("");
  const [editAr, setEditAr] = useState("");

  const sorted = [...books].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

  function startEditing(book: ApiBook) {
    setEditingId(book.id);
    setEditSource(book.source);
    setEditTitle(book.title);
    setEditAr(book.arLevel == null ? "" : String(book.arLevel));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const ar = parseArInput(editAr);
    if (ar === undefined) return; // the number input's own validation explains why
    onUpdate(editingId, editSource, editTitle, ar);
    setEditingId(null);
  }

  if (books.length === 0) {
    return <p className="empty-hint book-list-empty">No books logged for {studentName} yet.</p>;
  }

  return (
    <div className="book-list">
      <h3 className="book-list-heading">{studentName}'s books</h3>
      <ul>
        {sorted.map((book) =>
          editingId === book.id ? (
            <li key={book.id} className="book-list-row editing">
              <form className="book-edit-form" onSubmit={handleSave}>
                <div className="segmented small" role="radiogroup" aria-label="Book source">
                  <button
                    type="button"
                    className={editSource === "WonderRoom" ? "active" : ""}
                    aria-pressed={editSource === "WonderRoom"}
                    onClick={() => setEditSource("WonderRoom")}
                  >
                    <span className="swatch swatch-wonderroom" aria-hidden="true" />
                    WonderRoom
                  </button>
                  <button
                    type="button"
                    className={editSource === "Others" ? "active" : ""}
                    aria-pressed={editSource === "Others"}
                    onClick={() => setEditSource("Others")}
                  >
                    <span className="swatch swatch-others" aria-hidden="true" />
                    Others
                  </button>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Book title (optional)"
                  autoFocus
                />
                <input
                  type="number"
                  className="ar-input-small"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="20"
                  value={editAr}
                  onChange={(e) => setEditAr(e.target.value)}
                  placeholder="AR"
                  aria-label="AR level"
                />
                <div className="book-edit-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Look up AR level on AR BookFinder"
                    title="Look up AR level (copies the title)"
                    onClick={() => lookUpArLevel(editTitle)}
                  >
                    ↗
                  </button>
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
                </div>
              </form>
            </li>
          ) : (
            <li key={book.id} className="book-list-row">
              <span className={`swatch swatch-${book.source === "WonderRoom" ? "wonderroom" : "others"}`} />
              <span className="book-list-title">{book.title || <em>Untitled</em>}</span>
              {book.arLevel != null && (
                <span className="ar-chip" title="AR level">
                  AR {book.arLevel.toFixed(1)}
                </span>
              )}
              <span className="book-list-date">{formatDate(book.dateAdded)}</span>
              <span className="roster-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Edit ${book.title || "book"}`}
                  title="Edit"
                  onClick={() => startEditing(book)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Delete ${book.title || "book"}`}
                  title="Delete"
                  onClick={() => {
                    if (confirm("Delete this book entry?")) onRemove(book.id);
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
